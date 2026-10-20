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
  ).toEqual({ ready: true, test_only: true });
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
});
