import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

let db: PGlite;
const owner = "10000000-0000-4000-8000-000000000010";
const requestId = "50000000-0000-4000-8000-000000000001";
const ownerHash = "a".repeat(64),
  requestHash = "b".repeat(64);
let variant: string;
const details = {
  email: "payment@example.test",
  firstName: "Test",
  lastName: "Shopper",
  phone: "",
  addressLine1: "1 Test Street",
  addressLine2: "",
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB",
};

test.beforeAll(async () => {
  test.setTimeout(120000);
  db = new PGlite();
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create role service_role nologin;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`,
  );
  for (const file of [
    "20261018000100_catalog.sql",
    "20261018000200_bag_availability.sql",
    "20261019000100_admin.sql",
    "20261019000200_admin_media.sql",
    "20261019000300_storefront_sync.sql",
    "20261019000400_product_delete.sql",
    "20261019000500_product_visibility.sql",
    "20261020000100_payments.sql",
    "20261020000200_order_records.sql",
    "20261020000300_stock_management.sql",
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id) values($1)", [owner]);
  await db.query(
    "insert into seen_private.admin_members(user_id,role) values($1,'owner')",
    [owner],
  );
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: owner, aal: "aal2" }),
  ]);
  await db.query("select public.admin_save_product($1,null)", [
    {
      design_reference: "design-01",
      name: "TEST ONLY",
      description: "Test only garment",
      price_pence: 8000,
      cost_pence: null,
      status: "published",
      details_confirmed: true,
      sort_order: 0,
      photos: [
        {
          src: "/images/products/design-01/front.webp",
          alt: "Test garment",
          label: "Front",
        },
      ],
      category: "",
      tone: "Burgundy",
      variants: [
        { size_label: "54", sku: "PAY-TEST-54", active: true, on_hand: 5 },
      ],
    },
  ]);
  variant = (
    await db.query<{ id: string }>("select id from public.product_variants")
  ).rows[0].id;
});
test.afterAll(async () => {
  await db?.close();
});
test.beforeEach(async () => {
  await db.exec("begin");
});
test.afterEach(async () => {
  await db.exec("rollback");
});

async function prepare(
  id = requestId,
  hash = ownerHash,
  quantity = 1,
  price = 8000,
  delivery = 0,
) {
  return (
    await db.query<any>(
      "select public.payment_prepare_order($1,$2,$3,$4,$5,'standard',$6,'http://localhost:3000') data",
      [
        id,
        hash,
        requestHash,
        details,
        [{ variant_id: variant, quantity, unit_price_pence: price }],
        delivery,
      ],
    )
  ).rows[0].data;
}
async function apply(
  order: any,
  state: string,
  event = `evt_${state}`,
  changes = {},
) {
  return (
    await db.query<any>(
      "select public.payment_apply_session($1,$2,'checkout.session.test',$3) data",
      [
        order.id,
        event,
        {
          id: "cs_test_fixture",
          order_id: order.id,
          request_hash: order.request_hash,
          total_pence: order.total_pence,
          currency: "gbp",
          is_test: true,
          state,
          payment_intent: "pi_fixture",
          ...changes,
        },
      ],
    )
  ).rows[0].data;
}
async function stock() {
  return (
    await db.query<any>(
      "select on_hand,reserved from seen_private.inventory where variant_id=$1",
      [variant],
    )
  ).rows[0];
}
async function denied(fn: () => Promise<unknown>) {
  await db.exec("savepoint rejection");
  await expect(fn()).rejects.toThrow();
  await db.exec("rollback to savepoint rejection;release savepoint rejection");
}

test("reservation snapshots server prices, retries are idempotent and buyer ownership is checked", async () => {
  const first = await prepare();
  expect(first).toMatchObject({
    subtotal_pence: 8000,
    delivery_pence: 0,
    total_pence: 8000,
    is_test: true,
    state: "creating",
  });
  expect(first.items[0]).toMatchObject({
    variant_id: variant,
    quantity: 1,
    unit_price_pence: 8000,
    size: "54",
  });
  expect(await stock()).toEqual({ on_hand: 5, reserved: 1 });
  expect((await prepare()).id).toBe(first.id);
  expect(await stock()).toEqual({ on_hand: 5, reserved: 1 });
  await denied(() => prepare(requestId, "c".repeat(64)));
  const hidden = await db.query<any>(
    "select public.payment_get_order($1,$2) data",
    [first.id, "c".repeat(64)],
  );
  expect(hidden.rows[0].data).toBeNull();
});

test("stock and price checks are atomic and prevent overselling or caller totals", async () => {
  await denied(() => prepare(requestId, ownerHash, 1, 1));
  await denied(() => prepare(requestId, ownerHash, 1, 8000, 1));
  expect(await stock()).toEqual({ on_hand: 5, reserved: 0 });
  await prepare(requestId, ownerHash, 5);
  await denied(() =>
    prepare("50000000-0000-4000-8000-000000000002", "d".repeat(64)),
  );
  expect(await stock()).toEqual({ on_hand: 5, reserved: 5 });
});

test("pending payments retain stock; paid sandbox events release once without selling physical inventory", async () => {
  const order = await prepare();
  await apply(order, "pending");
  expect(await stock()).toEqual({ on_hand: 5, reserved: 1 });
  expect((await apply(order, "paid")).state).toBe("paid");
  await apply(order, "paid");
  await apply(order, "expired", "evt_late_expired");
  expect(await stock()).toEqual({ on_hand: 5, reserved: 0 });
  const row = (
    await db.query<any>(
      "select payload from seen_private.admin_records where id=$1",
      [order.id],
    )
  ).rows[0].payload;
  expect(row).toMatchObject({
    is_test: true,
    payment_status: "paid",
    status: "confirmed",
    stock_state: "released",
  });
  const stats = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data.statistics;
  expect(Number(stats.paidPence)).toBe(0);
  expect(Number(stats.orderCount)).toBe(0);
  const version = (
    await db.query<any>(
      "select version from seen_private.admin_records where id=$1",
      [order.id],
    )
  ).rows[0].version;
  await db.exec("savepoint fulfilment");
  await expect(
    db.query("select public.admin_save_record('order',$1,$2,$3)", [
      order.id,
      { status: "shipped", tracking: "", notes: "" },
      version,
    ]),
  ).rejects.toThrow("cannot be fulfilled");
  await db.exec(
    "rollback to savepoint fulfilment;release savepoint fulfilment",
  );
});

test("failure releases once; wrong amounts, modes, sessions and metadata never settle an order", async () => {
  const order = await prepare();
  for (const changes of [
    { total_pence: 1 },
    { is_test: false },
    { currency: "usd" },
    { order_id: "wrong" },
    { request_hash: "d".repeat(64) },
    { id: "cs_live_wrong" },
    { payment_intent: null },
  ])
    await denied(() => apply(order, "paid", "evt_wrong", changes));
  expect(await stock()).toEqual({ on_hand: 5, reserved: 1 });
  await apply(order, "failed");
  await apply(order, "failed");
  expect(await stock()).toEqual({ on_hand: 5, reserved: 0 });
  expect((await apply(order, "paid", "evt_unexpected_late_paid")).state).toBe(
    "attention",
  );
});

test("only the server role can access payment RPCs and private order data is never public", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set local role ${role}`);
    await denied(() => db.query("select public.payment_health()"));
    await denied(() => prepare());
    await denied(() => db.query("select * from seen_private.checkout_orders"));
    await db.exec("reset role");
  }
  await db.exec("set local role service_role");
  expect(
    (await db.query<any>("select public.payment_health() data")).rows[0].data,
  ).toMatchObject({ ready: true, test_only: true, order_records_ready: true });
});

test("orphan cleanup cannot release an active creation window and only releases once", async () => {
  const order = await prepare();
  await denied(() =>
    db.query("select public.payment_release_orphan($1)", [order.id]),
  );
  await db.query(
    "update seen_private.checkout_orders set expires_at=clock_timestamp()-interval '11 minutes' where id=$1",
    [order.id],
  );
  await db.query("select public.payment_release_orphan($1)", [order.id]);
  expect(await stock()).toEqual({ on_hand: 5, reserved: 0 });
  await denied(() =>
    db.query("select public.payment_release_orphan($1)", [order.id]),
  );
});

test("unverified delivery is flagged for review rather than fulfilment", async () => {
  const order = await prepare();
  const result = await apply(order, "paid", "evt_invalid_delivery", {
    delivery_verified: false,
  });
  expect(result.state).toBe("attention");
  expect(await stock()).toEqual({ on_hand: 5, reserved: 1 });
  const record = (
    await db.query<any>(
      "select payload,version from seen_private.admin_records where id=$1",
      [order.id],
    )
  ).rows[0];
  expect(record.payload.needs_attention).toBe(true);
  await denied(() =>
    db.query("select public.admin_save_record('order',$1,$2,$3)", [
      order.id,
      { status: "shipped", tracking: "", notes: "" },
      record.version,
    ]),
  );
});

test("reconciliation rotates pending batches so unchanged sessions cannot block later orders", async () => {
  const a = await prepare();
  const b = await prepare(
    "50000000-0000-4000-8000-000000000002",
    "c".repeat(64),
  );
  const first = (
    await db.query<any>("select public.payment_pending_orders(1) data")
  ).rows[0].data;
  const next = (
    await db.query<any>("select public.payment_pending_orders(1) data")
  ).rows[0].data;
  expect(first).toHaveLength(1);
  expect(next).toHaveLength(1);
  expect(new Set([first[0].id, next[0].id])).toEqual(new Set([a.id, b.id]));
  expect((await db.query<any>("select public.payment_pending_orders(10) data")).rows[0].data).toEqual([]);
  await db.exec("update seen_private.checkout_orders set recovery_lease_until=clock_timestamp()-interval '1 second'");
  expect((await db.query<any>("select public.payment_pending_orders(10) data")).rows[0].data).toHaveLength(2);
});

test("stock history records reservation and one terminal movement without exposing inventory to browsers", async () => {
  const order=await prepare(requestId,ownerHash,2);
  await apply(order,"paid");await apply(order,"paid");
  const events=(await db.query("select movement,quantity,on_hand_delta from seen_private.checkout_stock_events where order_id=$1 order by occurred_at",[order.id])).rows;
  expect(events).toEqual([{movement:"reserved",quantity:2,on_hand_delta:0},{movement:"released",quantity:2,on_hand_delta:0}]);
  for(const role of ["anon","authenticated","service_role"]){
    await db.exec(`set local role ${role}`);
    await denied(()=>db.query("select * from seen_private.checkout_stock_events"));
    await db.exec("reset role");
  }
  await denied(()=>db.query("update seen_private.checkout_orders set stock_state='reserved' where id=$1",[order.id]));
  expect(await stock()).toEqual({on_hand:5,reserved:0});
});

test("sandbox commits are rejected and a mismatched reservation rolls back every purchase movement", async () => {
  const order=await prepare();
  await denied(()=>db.query("update seen_private.checkout_orders set state='paid',stock_state='committed' where id=$1",[order.id]));
  expect(await stock()).toEqual({on_hand:5,reserved:1});
  // Simulate private corruption to prove failure never produces a paid order.
  await db.query("update seen_private.inventory set reserved=0 where variant_id=$1",[variant]);
  await denied(()=>apply(order,"paid"));
  expect((await db.query<any>("select state,stock_state from seen_private.checkout_orders where id=$1",[order.id])).rows[0]).toEqual({state:"creating",stock_state:"reserved"});
  expect((await db.query("select * from seen_private.stripe_event_receipts")).rows).toHaveLength(0);
});

test("prepared physical-stock commit deducts once while the production schema still forbids live orders", async () => {
  const template=await prepare(requestId,ownerHash,2);await apply(template,"expired");
  // Only this rolled-back isolated database relaxes the test-only constraint to
  // exercise the internal future-live stock branch. Hosted/live checkout stays blocked.
  await db.exec("alter table seen_private.checkout_orders drop constraint checkout_orders_is_test_check");
  const live=(await db.query<any>(`insert into seen_private.checkout_orders(request_id,owner_hash,request_hash,order_number,is_test,details,delivery,subtotal_pence,delivery_pence,total_pence,return_origin)
    select gen_random_uuid(),owner_hash,request_hash,'ISOLATED-STOCK-ONLY',false,details,delivery,subtotal_pence,delivery_pence,total_pence,return_origin from seen_private.checkout_orders where id=$1 returning id`,[template.id])).rows[0];
  await db.query(`insert into seen_private.checkout_items select $1,variant_id,product_id,quantity,unit_price_pence,snapshot from seen_private.checkout_items where order_id=$2`,[live.id,template.id]);
  await db.query("update seen_private.inventory set reserved=2 where variant_id=$1",[variant]);
  await db.query("update seen_private.checkout_orders set state='paid',stock_state='committed' where id=$1",[live.id]);
  expect(await stock()).toEqual({on_hand:3,reserved:0});
  await db.query("update seen_private.checkout_orders set stock_state='committed' where id=$1",[live.id]);
  expect(await stock()).toEqual({on_hand:3,reserved:0});
  expect((await db.query("select movement,quantity,on_hand_delta from seen_private.checkout_stock_events where order_id=$1 and movement='committed'",[live.id])).rows).toEqual([{movement:"committed",quantity:2,on_hand_delta:-2}]);
  await denied(()=>db.query("update seen_private.checkout_orders set stock_state='reserved' where id=$1",[live.id]));
});

test("multiple items settle atomically and stale admin stock cannot overwrite an active reservation", async () => {
  const p=(await db.query<any>("select id,updated_at from public.products")).rows[0];
  const other=(await db.query<any>("insert into public.product_variants(product_id,size_label,active) values($1,'56',true) returning id",[p.id])).rows[0].id;
  await db.query("insert into seen_private.inventory(variant_id,on_hand) values($1,3)",[other]);
  const order=(await db.query<any>("select public.payment_prepare_order($1,$2,$3,$4,$5,'standard',0,'http://localhost:3000') data",[requestId,ownerHash,requestHash,details,[{variant_id:variant,quantity:2,unit_price_pence:8000},{variant_id:other,quantity:3,unit_price_pence:8000}]])).rows[0].data;
  await denied(()=>db.query("select public.admin_bulk_products($1,'stock',0)",[[p.id]]));
  expect(await stock()).toEqual({on_hand:5,reserved:2});
  // An inconsistent second row must roll back the first row's release too.
  await db.query("update seen_private.inventory set reserved=0 where variant_id=$1",[other]);
  await denied(()=>apply(order,"expired"));
  expect(await stock()).toEqual({on_hand:5,reserved:2});
  await db.query("update seen_private.inventory set reserved=3 where variant_id=$1",[other]);
  await apply(order,"expired");
  expect(await stock()).toEqual({on_hand:5,reserved:0});
  expect((await db.query<any>("select on_hand,reserved from seen_private.inventory where variant_id=$1",[other])).rows[0]).toEqual({on_hand:3,reserved:0});
});

test("verified purchases freeze item prices and contact details, confirm once and preserve owner notes on retries", async () => {
  const order = await prepare(requestId, ownerHash, 2);
  await db.query("update public.products set name='Changed later',price_pence=9000 where id=$1", [order.items[0].product_id]);
  const finalDetails = { ...details, email: "final-contact@example.test", phone: "+447700900123", recipientName: "Delivery Recipient" };
  const paid = await apply(order,"paid","evt_first_confirmation",{details:finalDetails});
  expect(paid.confirmed_at).toBeTruthy();
  expect(paid.payment_verified_at).toBeTruthy();
  const saved = (await db.query<any>("select * from seen_private.admin_records where id=$1",[order.id])).rows[0];
  expect(saved.payload).toMatchObject({ source:"stripe_checkout", email:finalDetails.email, phone:finalDetails.phone, name:"Delivery Recipient", checkout_state:"paid", status:"confirmed", total_pence:16000, delivery:{carrier:"Royal Mail",chargePence:0} });
  expect(saved.payload.items[0]).toMatchObject({name:"TEST ONLY",size:"54",quantity:2,unit_price_pence:8000,line_total_pence:16000});
  await db.query("select public.admin_save_record('order',$1,$2,$3)",[order.id,{status:"confirmed",tracking:"NOTE-ONLY",notes:"Keep this note"},saved.version]);
  const noteVersion=(await db.query<any>("select version from seen_private.admin_records where id=$1",[order.id])).rows[0].version;
  const replay=await apply(order,"paid","evt_first_confirmation",{details:finalDetails});
  await apply(order,"paid","evt_second_confirmation",{details:finalDetails});
  expect(replay.confirmed_at).toBe(paid.confirmed_at);
  const again=(await db.query<any>("select payload,version from seen_private.admin_records where id=$1",[order.id])).rows[0];
  expect(again.payload.notes).toBe("Keep this note");expect(again.payload.tracking).toBe("NOTE-ONLY");expect(again.version).toBe(noteVersion);
  expect((await db.query("select count(*)::int count from seen_private.admin_audit where action='payment_confirmed'")).rows[0]).toEqual({count:1});
  await denied(()=>db.query("update seen_private.checkout_items set quantity=1 where order_id=$1",[order.id]));
  await denied(()=>db.query("update seen_private.checkout_orders set total_pence=1 where id=$1",[order.id]));
  await denied(()=>db.query("update seen_private.checkout_orders set details='{}' where id=$1",[order.id]));
});

test("a lost admin projection is repaired without duplicating the purchase or changing inventory", async () => {
  const order=await prepare();await apply(order,"paid","evt_repair");
  await db.query("delete from seen_private.admin_records where id=$1",[order.id]);
  await apply(order,"paid","evt_repair");
  expect((await db.query("select count(*)::int count from seen_private.admin_records where kind='order'")).rows[0]).toEqual({count:1});
  expect((await db.query<any>("select payload from seen_private.admin_records where id=$1",[order.id])).rows[0].payload).toMatchObject({source:"stripe_checkout",payment_status:"paid",status:"confirmed"});
  expect(await stock()).toEqual({on_hand:5,reserved:0});
});

test("pending and attention checkouts cannot be manually confirmed and failed attempts never gain a confirmation time", async () => {
  const order=await prepare();await apply(order,"pending");
  const record=(await db.query<any>("select version from seen_private.admin_records where id=$1",[order.id])).rows[0];
  await denied(()=>db.query("select public.admin_save_record('order',$1,$2,$3)",[order.id,{status:"confirmed",tracking:"",notes:""},record.version]));
  const failed=await apply(order,"failed");expect(failed.confirmed_at).toBeNull();expect(failed.payment_verified_at).toBeNull();
  const attention=await apply(order,"paid","evt_late_attention");expect(attention.state).toBe("attention");expect(attention.payment_verified_at).toBeTruthy();expect(attention.confirmed_at).toBeNull();
});

test("one provider payment cannot settle two purchases and projection backfill is rerunnable", async () => {
  const a=await prepare();await apply(a,"paid","evt_a");
  const b=await prepare("50000000-0000-4000-8000-000000000099","e".repeat(64));
  await denied(()=>apply(b,"paid","evt_b"));
  expect((await db.query<any>("select state from seen_private.checkout_orders where id=$1",[b.id])).rows[0].state).toBe("creating");
  expect(await stock()).toEqual({on_hand:5,reserved:1});
  // The migration's outer transaction is managed by this test instead.
  const migration=(await readFile("supabase/migrations/20261020000200_order_records.sql","utf8")).replace(/^begin;$/m,"").replace(/^commit;$/m,"");
  await db.exec(migration);await db.exec(migration);
  // Restore the newest stock function after intentionally replaying an older migration.
  const stockMigration=(await readFile("supabase/migrations/20261020000300_stock_management.sql","utf8")).replace(/^begin;$/m,"").replace(/^commit;$/m,"");
  await db.exec(stockMigration);await db.exec(stockMigration);
  expect((await db.query("select count(*)::int count from seen_private.admin_records where kind='order'")).rows[0]).toEqual({count:2});
});
