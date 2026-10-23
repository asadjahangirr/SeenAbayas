import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { processOrderEmails, type EmailRpc } from "../../src/lib/order-emails/worker";
import { emailPurchaseSchema, type EmailClaim, type OrderEmailConfig } from "../../src/lib/order-emails/model";
import { defaultDocument, siteDocumentSchema } from "../../src/lib/cms/model";
import { defaultShippingSettings, parcelsForBag } from "../../src/lib/shipping/settings";
import { discountedPrices } from "../../src/lib/coupons/model";
import type { BagQuote } from "../../src/lib/bag/model";

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
    "20261021000100_live_payments.sql",
    "20261021000200_order_emails.sql",
    "20261022000100_shipping_quotes.sql",
    "20261023000100_shipping_read_compatibility.sql",
  "20261023000300_multi_parcel_shipping.sql",
  "20261023000400_checkout_coupons.sql",
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
          id: order.is_test ? "cs_test_fixture" : "cs_live_fixture",
          order_id: order.id,
          request_hash: order.request_hash,
          total_pence: order.total_pence,
          currency: "gbp",
          is_test: order.is_test,
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

test("fixed-mode read hotfix restores the legacy storefront contract without changing orders, stock, settings or read permissions", async () => {
  const order = await prepare();
  const document = structuredClone(defaultDocument);
  document.shipping.dispatchPostcode = "SW1A 1AA";
  document.shipping.variantWeights = { [variant]: 400 };
  await db.query("update seen_private.site_documents set published=$1,draft=$1 where id", [document]);
  // Reproduce the installed migration's original projection against a legacy
  // strict storefront schema before applying the standalone operator hotfix.
  await db.exec(`create or replace function public.get_site_document() returns jsonb language sql stable security definer set search_path='' as $$
    select case when published is null then null else jsonb_set(published,'{shipping}',jsonb_build_object('mode',coalesce(published#>>'{shipping,mode}','fixed')),true) end
    from seen_private.site_documents where id; $$;`);
  const oldStorefront = siteDocumentSchema.omit({ shipping: true });
  const read = async () => (await db.query<any>("select public.get_site_document() data")).rows[0].data;
  expect(oldStorefront.safeParse(await read()).success).toBe(false);
  const before = (await db.query<any>("select public.payment_get_order($1,$2) data", [order.id,ownerHash])).rows[0].data;
  const script = (await readFile("supabase/migrations/20261023000100_shipping_read_compatibility.sql","utf8")).replace(/^begin;\s*$/m,"").replace(/^commit;\s*$/m,"");
  for (let i=0;i<2;i++) {
    await db.exec(script);
    const data = await read();
    expect(oldStorefront.safeParse(data).success).toBe(true);
    expect(siteDocumentSchema.parse(data).shipping.mode).toBe("fixed");
    expect(data).not.toHaveProperty("shipping");
    expect(JSON.stringify(data)).not.toContain("SW1A 1AA");
    expect((await db.query<any>("select public.get_shipping_settings() data")).rows[0].data).toEqual(document.shipping);
    expect((await db.query<any>("select public.payment_get_order($1,$2) data",[order.id,ownerHash])).rows[0].data).toEqual(before);
    expect(await stock()).toEqual({on_hand:5,reserved:1});
  }
  expect((await db.query<any>("select published,draft from seen_private.site_documents where id")).rows[0]).toEqual({published:document,draft:document});
  await db.exec("set local role anon");
  expect(oldStorefront.safeParse(await read()).success).toBe(true);
  await denied(() => db.query("select public.get_shipping_settings()"));
  await db.exec("reset role");
});

test("public shipping reads preserve unpublished and pre-shipping documents", async () => {
  expect((await db.query<any>("select public.get_site_document() data")).rows[0].data).toBeNull();
  const { shipping: _shipping, ...legacy } = structuredClone(defaultDocument);
  await db.query("update seen_private.site_documents set published=$1 where id", [legacy]);
  expect((await db.query<any>("select public.get_site_document() data")).rows[0].data).toEqual(legacy);
});

async function shippingDocument(threshold = 10000) {
  const document = structuredClone(defaultDocument);
  document.commerce.freeDeliveryThresholdPence = threshold;
  document.shipping = { ...defaultShippingSettings, mode: "royal_mail_olp", accountType: "olp", dispatchPostcode: "SW1A 1AA",
    packagingWeightGrams: 100, lengthMm: 300, widthMm: 200, heightMm: 100, maxItemsPerParcel: 2,
    standardServiceCode: "TEST48", priceBasis: "cost_plus_vat", variantWeights: { [variant]: 400 } };
  await db.query("update seen_private.site_documents set draft=$1,published=$1 where id", [document]);
  return document;
}
async function carrierPrepare(document: typeof defaultDocument, patch: Record<string, unknown> = {}) {
  const delivery = { id: "standard", label: "Tracked 48", carrier: "Royal Mail", source: "royal_mail_olp", serviceCode: "TEST48", carrierCostPence: 425,
    chargePence: document.commerce.freeDeliveryThresholdPence <= 8000 ? 0 : 425, weightInGrams: 500, packageFormat: "SmallParcel", expiresAt: Date.now()+300000, ...patch };
  return (await db.query<any>("select public.payment_prepare_order_v3($1,$2,$3,$4,$5,'standard',$6,'http://localhost:3000','live',$7,$8,$9) data",
    [requestId, ownerHash, requestHash, details, [{ variant_id: variant, quantity: 1, unit_price_pence: 8000 }], delivery.chargePence, delivery, document.shipping, document.commerce])).rows[0].data;
}

test("carrier order snapshots the verified shipping amount and keeps reservation/idempotency guarantees", async () => {
  const document = await shippingDocument();
  const order = await carrierPrepare(document);
  expect(order).toMatchObject({ subtotal_pence: 8000, delivery_pence: 425, total_pence: 8425, is_test: false, delivery: { source: "royal_mail_olp", serviceCode: "TEST48", carrierCostPence: 425 } });
  expect((await carrierPrepare(document)).id).toBe(order.id);
  expect(await stock()).toEqual({ on_hand: 5, reserved: 1 });
  expect((await apply(order,"paid","evt_shipping_paid")).stock_state).toBe("committed");
  expect(await stock()).toEqual({ on_hand: 4, reserved: 0 });
});
test("carrier checkout includes the free threshold while retaining actual postage cost", async () => {
  const order = await carrierPrepare(await shippingDocument(8000));
  expect(order).toMatchObject({ delivery_pence: 0, total_pence: 8000, delivery: { chargePence: 0, carrierCostPence: 425 } });
});
test("expired, changed or missing carrier snapshots cannot reserve stock and older fixed-fee paths cannot bypass carrier mode", async () => {
  const document = await shippingDocument();
  for (const patch of [{ expiresAt: 0 }, { expiresAt: null }, { weightInGrams: 501 }, { serviceCode: "OTHER" }, { chargePence: 1 }, { source: "fixed" }])
    await denied(() => carrierPrepare(document, patch));
  const changed = structuredClone(document); changed.shipping.packagingWeightGrams=101;
  await db.query("update seen_private.site_documents set published=$1 where id", [changed]);
  await denied(() => carrierPrepare(document));
  // Legacy public backend function computes fixed zero at £80; the insert guard still rejects it.
  await denied(() => prepare());
  expect(await stock()).toEqual({ on_hand: 5, reserved: 0 });
});
test("public CMS strips parcel/origin settings and anonymous roles cannot read the private configuration or prepare quotes", async () => {
  await shippingDocument();
  await db.exec("set local role anon");
  const publicDocument = (await db.query<any>("select public.get_site_document() data")).rows[0].data;
  expect(publicDocument.shipping).toEqual({ mode: "royal_mail_olp" });
  expect(JSON.stringify(publicDocument)).not.toContain("SW1A 1AA");
  await denied(() => db.query("select public.get_shipping_settings()"));
  await denied(() => db.query("select public.admin_shipping_health()"));
  await denied(() => db.query("select public.shipping_quote_attempt($1,$2)",[ownerHash,requestHash]));
  await db.exec("reset role");
});
test("editors cannot change parcel settings through the existing CMS save function", async () => {
  const document = await shippingDocument();
  const editor = "10000000-0000-4000-8000-000000000011";
  await db.query("insert into auth.users(id) values($1)",[editor]);
  await db.query("insert into seen_private.admin_members(user_id,role) values($1,'editor')",[editor]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:editor,aal:"aal2"})]);
  const changed = structuredClone(document); changed.shipping.packagingWeightGrams=200;
  await denied(() => db.query("select public.admin_save_site($1,0,true)",[changed]));
  await denied(() => db.query("select public.admin_shipping_health()"));
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner,aal:"aal2"})]);
  expect((await db.query<any>("select public.admin_shipping_health() data")).rows[0].data).toEqual({quotes_ready:true,multi_parcel_ready:true,fulfilment_ready:false});
  await db.query("select public.admin_save_site($1,0,false)",[changed]);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:editor,aal:"aal2"})]);
  // Editors cannot publish an owner's still-private parcel changes unchanged.
  await denied(() => db.query("select public.admin_save_site($1,1,true)",[changed]));
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner,aal:"aal1"})]);
  await denied(() => db.query("select public.admin_shipping_health()"));
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner,aal:"aal2"})]);
});
test("shared quote limits reject excess attempts without touching commerce records", async () => {
  for (let i=0;i<10;i++) await db.query("select public.shipping_quote_attempt($1,$2)",[ownerHash,requestHash]);
  await denied(() => db.query("select public.shipping_quote_attempt($1,$2)",[ownerHash,requestHash]));
  expect((await db.query<any>("select count(*)::integer n from seen_private.shipping_quote_attempts")).rows[0].n).toBe(10);
  expect(await stock()).toEqual({on_hand:5,reserved:0});
});
test("shipping migration reruns preserve existing orders, reservations and saved settings", async () => {
  const document = await shippingDocument(); const order = await carrierPrepare(document);
  const script = (await readFile("supabase/migrations/20261022000100_shipping_quotes.sql","utf8")).replace(/^begin;\s*$/m,"").replace(/^commit;\s*$/m,"");
  await db.exec(script);
  expect(await stock()).toEqual({on_hand:5,reserved:1});
  expect((await carrierPrepare(document)).id).toBe(order.id);
  expect((await db.query<any>("select public.get_shipping_settings() data")).rows[0].data).toEqual(document.shipping);
});

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
  ).toMatchObject({ ready: true, test_only: false, order_records_ready: true, live_payments_ready:true });
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

test("physical-stock commit deducts once and cannot be reversed into a fresh reservation", async () => {
  const template=await prepare(requestId,ownerHash,2);await apply(template,"expired");
  // Isolated fixture: exercise the physical branch without any provider charge.
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

test("live orders reserve, settle once, deduct physical units and contribute to verified finance",async()=>{
  const live=(await db.query<any>("select public.payment_prepare_order_v2($1,$2,$3,$4,$5,'standard',0,'https://www.seenabayas.co.uk','live') data",[requestId,ownerHash,requestHash,details,[{variant_id:variant,quantity:2,unit_price_pence:8000}]])).rows[0].data;
  expect(live.is_test).toBe(false);expect(live.order_number).toMatch(/^SEEN-[A-F0-9]+$/);expect(live.tax_pence).toBe(0);
  await denied(()=>apply(live,"paid","evt_wrong_mode",{is_test:true,id:"cs_test_wrong"}));
  await apply(live,"paid","evt_real_fixture");await apply(live,"paid","evt_real_fixture");
  expect(await stock()).toEqual({on_hand:3,reserved:0});
  const stats=(await db.query<any>("select public.admin_snapshot() data")).rows[0].data.statistics;
  expect(Number(stats.paidPence)).toBe(16000);expect(Number(stats.orderCount)).toBe(1);
  const record=(await db.query<any>("select payload from seen_private.admin_records where id=$1",[live.id])).rows[0].payload;
  expect(record).toMatchObject({is_test:false,payment_status:"paid",stock_state:"committed",tax_pence:0});
});

test("live failure releases without deduction and new mode RPC rejects callers outside the service role",async()=>{
  const args=[requestId,ownerHash,requestHash,details,[{variant_id:variant,quantity:2,unit_price_pence:8000}]];
  const sql="select public.payment_prepare_order_v2($1,$2,$3,$4,$5,'standard',0,'https://www.seenabayas.co.uk','live') data";
  const live=(await db.query<any>(sql,args)).rows[0].data;
  await apply(live,"expired");expect(await stock()).toEqual({on_hand:5,reserved:0});
  for(const role of ["anon","authenticated"]){await db.exec(`set local role ${role}`);await denied(()=>db.query(sql,args));await db.exec("reset role");}
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

const emailConfig: OrderEmailConfig = { apiKey: "re_UNIT_TEST_ONLY", from: "orders@mail.seenabayas.co.uk", origin: "https://www.seenabayas.co.uk", mode: "live" };
const emailArguments: Record<string, string[]> = {
  order_email_claim: ["target_order", "batch_size", "payment_mode"], order_email_freeze: ["email_id", "claim", "message"],
  order_email_finish: ["email_id", "claim", "outcome", "provider_id"], order_email_status: ["target_order"],
};
const emailRpc: EmailRpc = async <T>(name: string, args: Record<string, unknown> = {}) => {
  const values = emailArguments[name].map(key => args[key] ?? (key === "payment_mode" ? "live" : null));
  return (await db.query<{ data: T }>(`select public.${name}(${values.map((_, i) => "$" + (i + 1)).join(",")}) data`, values)).rows[0].data;
};
async function liveForEmail() {
  return (await db.query<any>("select public.payment_prepare_order_v2($1,$2,$3,$4,$5,'standard',0,'https://www.seenabayas.co.uk','live') data", [
    requestId, ownerHash, requestHash, details, [{ variant_id: variant, quantity: 2, unit_price_pence: 8000 }],
  ])).rows[0].data;
}
const acceptedResponse = () => Response.json({ id: "80000000-0000-4000-8000-000000000001" });

test("email queue starts at verified confirmation, freezes purchased facts and ignores payment replays", async () => {
  const order = await liveForEmail();
  expect((await db.query("select * from seen_private.order_emails")).rows).toHaveLength(0);
  await apply(order, "pending");
  expect((await db.query("select * from seen_private.order_emails")).rows).toHaveLength(0);
  await apply(order, "paid", "evt_email_paid");
  await apply(order, "paid", "evt_email_paid");
  await apply(order, "expired", "evt_email_late_expiry");
  await db.query("update public.products set name='New display name',price_pence=12000");
  const rows = (await db.query<any>("select kind,snapshot from seen_private.order_emails order by kind")).rows;
  expect(rows.map(r => r.kind)).toEqual(["customer_confirmation", "owner_notification"]);
  for (const row of rows) {
    const saved = emailPurchaseSchema.parse(row.snapshot);
    expect(saved.total_pence).toBe(16000);
    expect(saved.items[0]).toMatchObject({ name: "TEST ONLY", size: "54", quantity: 2, unit_price_pence: 8000 });
    expect(JSON.stringify(row.snapshot)).not.toMatch(/owner_hash|request_hash|session_id|checkout_url/);
  }
  const migration = (await readFile("supabase/migrations/20261021000200_order_emails.sql", "utf8")).replace(/^begin;$/m, "").replace(/^commit;$/m, "");
  await db.exec(migration); await db.exec(migration);
  expect((await db.query("select * from seen_private.order_emails")).rows).toHaveLength(2);
});

test("email worker sends two separate receipts, records acceptance once and does not change payment or stock", async () => {
  const order = await liveForEmail(); await apply(order, "paid");
  const requests: any[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    expect(String(url)).toBe("https://api.resend.com/emails");
    requests.push(JSON.parse(init!.body as string));
    return acceptedResponse();
  };
  expect(await processOrderEmails(emailConfig, emailRpc, order.id, fetcher)).toMatchObject({ accepted: 2, retryRequired: 0 });
  expect(requests.map(r => r.to[0]).sort()).toEqual([details.email, "info@seenabayas.co.uk"].sort());
  const customer = requests.find(r => r.to[0] === details.email);
  expect(customer.reply_to).toBe("info@seenabayas.co.uk");
  expect(customer.text).toContain("Size 54 | Quantity 2 | £80.00 each | £160.00");
  expect(customer.text).toContain("SW1A 1AA");
  expect(requests.find(r => r.to[0] === "info@seenabayas.co.uk").reply_to).toBe(details.email);
  expect(await processOrderEmails(emailConfig, emailRpc, order.id, fetcher)).toMatchObject({ checked: 0 });
  expect(requests).toHaveLength(2);
  expect(await stock()).toEqual({ on_hand: 3, reserved: 0 });
  const status = await emailRpc<any>("order_email_status", { target_order: order.id });
  expect(status.counts).toEqual({ accepted: 2 });
  expect(JSON.stringify(status)).not.toMatch(/example.test|owner_hash|request_hash|re_UNIT|from|html/);
});

test("a lost acceptance acknowledgement replays the identical frozen message and key after lease recovery", async () => {
  const order = await liveForEmail(); await apply(order, "paid");
  let lost = false;
  const unreliableRpc: EmailRpc = async <T>(name: string, args?: Record<string, unknown>) => {
    if (!lost && name === "order_email_finish" && args?.outcome === "accepted") { lost = true; throw new Error("Simulated lost DB acknowledgement"); }
    return emailRpc<T>(name, args);
  };
  const seen = new Map<string, string>();
  const fetcher: typeof fetch = async (_url, init) => {
    const key = (init!.headers as Record<string, string>)["Idempotency-Key"];
    const body = init!.body as string;
    if (seen.has(key)) expect(body).toBe(seen.get(key));
    else seen.set(key, body);
    return acceptedResponse();
  };
  expect(await processOrderEmails(emailConfig, unreliableRpc, order.id, fetcher)).toMatchObject({ accepted: 1, retryRequired: 1 });
  await db.exec("update seen_private.order_emails set lease_until=clock_timestamp()-interval '1 second' where state='sending'");
  expect(await processOrderEmails({ ...emailConfig, from: "changed@mail.seenabayas.co.uk" }, emailRpc, order.id, fetcher)).toMatchObject({ accepted: 1, retryRequired: 0 });
  expect(seen.size).toBe(2);
});

test("partial email failure retries only the failed recipient while the paid order stays confirmed", async () => {
  const order = await liveForEmail(); await apply(order, "paid");
  const first = await processOrderEmails(emailConfig, emailRpc, order.id, async (_url, init) => {
    return JSON.parse(init!.body as string).to[0] === "info@seenabayas.co.uk" ? Response.json({}, { status: 429 }) : acceptedResponse();
  });
  expect(first).toMatchObject({ accepted: 1, retryRequired: 1 });
  expect((await db.query<any>("select state from seen_private.checkout_orders where id=$1", [order.id])).rows[0].state).toBe("paid");
  await db.exec("update seen_private.order_emails set next_attempt_at=clock_timestamp()-interval '1 second' where state='queued'");
  const targets: string[] = [];
  const result = await processOrderEmails(emailConfig, emailRpc, undefined, async (_url, init) => {
    targets.push(JSON.parse(init!.body as string).to[0]); return acceptedResponse();
  });
  expect(result.accepted).toBe(1); expect(targets).toEqual(["info@seenabayas.co.uk"]);
});

test("sandbox mail is suppressed by default and both test messages use a controlled inbox when enabled", async () => {
  const order = await prepare(); await apply(order, "paid");
  expect(await processOrderEmails({ ...emailConfig, mode: "test" }, emailRpc, order.id, async () => { throw new Error("Must not send"); })).toMatchObject({ suppressed: 2 });
  // A new sandbox purchase can deliberately test delivery, never using its fictional address.
  const second = await prepare("50000000-0000-4000-8000-000000000005");
  await apply(second, "paid", "evt_sandbox_email_2", { payment_intent: "pi_second_email", id: "cs_test_second_email" });
  const messages: any[] = [];
  expect(await processOrderEmails({ ...emailConfig, mode: "test", testRecipient: "controlled@example.test" }, emailRpc, second.id, async (_url, init) => {
    messages.push(JSON.parse(init!.body as string)); return acceptedResponse();
  })).toMatchObject({ accepted: 2 });
  for (const message of messages) {
    expect(message.to).toEqual(["controlled@example.test"]);
    expect(message.subject).toMatch(/^\[TEST\]/); expect(message.text).toContain("Do not dispatch");
  }
  expect(await stock()).toEqual({ on_hand: 5, reserved: 0 });
});

test("mail leases exclude competing workers and stale acknowledgements; expired idempotency windows require review", async () => {
  const order = await liveForEmail(); await apply(order, "paid");
  const first = await emailRpc<EmailClaim[]>("order_email_claim", { target_order: order.id, batch_size: 2 });
  expect(first).toHaveLength(2);
  expect(await emailRpc("order_email_claim", { target_order: order.id, batch_size: 2 })).toEqual([]);
  await db.exec("update seen_private.order_emails set lease_until=clock_timestamp()-interval '1 second'");
  const second = await emailRpc<EmailClaim[]>("order_email_claim", { target_order: order.id, batch_size: 2 });
  expect(second[0].claim_token).not.toBe(first[0].claim_token);
  expect(await emailRpc("order_email_finish", { email_id: first[0].id, claim: first[0].claim_token, outcome: "accepted", provider_id: "old" })).toBe(false);
  await denied(() => emailRpc("order_email_freeze", { email_id: first[0].id, claim: first[0].claim_token, message: {} }));
  await db.exec("update seen_private.order_emails set first_attempt_at=clock_timestamp()-interval '25 hours',lease_until=clock_timestamp()-interval '1 second'");
  expect(await emailRpc("order_email_claim", { target_order: order.id, batch_size: 2 })).toEqual([]);
  expect((await emailRpc<any>("order_email_status", { target_order: order.id })).counts).toEqual({ review: 2 });
});

test("pending, failed and attention orders never send a customer confirmation", async () => {
  const order = await prepare(); await apply(order, "pending"); await apply(order, "failed"); await apply(order, "paid", "evt_late_email_attention");
  expect((await db.query("select * from seen_private.order_emails")).rows).toHaveLength(0);
});

test("private email payloads are inaccessible to browsers and RPCs require the service role", async () => {
  const order = await liveForEmail(); await apply(order, "paid");
  for (const role of ["anon", "authenticated", "service_role"]) {
    await db.exec(`set local role ${role}`);
    await denied(() => db.query("select * from seen_private.order_emails"));
    if (role !== "service_role") {
      await denied(() => emailRpc("order_email_claim", { target_order: order.id, batch_size: 2 }));
      await denied(() => emailRpc("order_email_status", { target_order: order.id }));
      await denied(() => emailRpc("order_email_freeze", { email_id: order.id, claim: order.id, message: {} }));
      await denied(() => emailRpc("order_email_finish", { email_id: order.id, claim: order.id, outcome: "retry" }));
    } else expect((await emailRpc<any>("order_email_status", { target_order: order.id })).counts).toEqual({ queued: 2 });
    await db.exec("reset role");
  }
});

test("invalid saved details and permanent provider rejection stop for review without repeating sends", async () => {
  const order = await liveForEmail(); await apply(order, "paid");
  await db.exec("update seen_private.order_emails set snapshot=snapshot||'{\"total_pence\":1}'::jsonb where kind='customer_confirmation'");
  let sends = 0;
  const fetcher: typeof fetch = async () => { sends++; return Response.json({ message: "Private recipient detail must not be saved" }, { status: 422 }); };
  expect(await processOrderEmails(emailConfig, emailRpc, order.id, fetcher)).toMatchObject({ review: 2 });
  expect(sends).toBe(1);
  expect(await processOrderEmails(emailConfig, emailRpc, order.id, fetcher)).toMatchObject({ checked: 0 });
  const status = await emailRpc<any>("order_email_status", { target_order: order.id });
  expect(status.messages.map((m: any) => m.error).sort()).toEqual(["invalid_snapshot", "provider_rejected"]);
  expect(JSON.stringify(status)).not.toContain("Private recipient");
});

test("a sandbox worker cannot claim live notifications even when the Supabase project is shared", async () => {
  const live = await liveForEmail(); await apply(live, "paid");
  const sandbox = await prepare("50000000-0000-4000-8000-000000000009", "f".repeat(64));
  await apply(sandbox, "paid", "evt_shared_email_test", { payment_intent: "pi_sandbox_separate", id: "cs_test_separate" });
  const messages: any[] = [];
  const result = await processOrderEmails({ ...emailConfig, mode: "test", testRecipient: "controlled@example.test" }, emailRpc, undefined, async (_url, init) => {
    messages.push(JSON.parse(init!.body as string)); return acceptedResponse();
  });
  expect(result.accepted).toBe(2);
  for (const message of messages) expect(message.to).toEqual(["controlled@example.test"]);
  expect((await emailRpc<any>("order_email_status", { target_order: live.id })).counts).toEqual({ queued: 2 });
});


test("SQL and browser-server packing agree for mixed weights, capacities and weight-limited parcels",async()=>{
  const second="20000000-0000-4000-8000-000000000002";
  for(const capacity of [1,2,3,10])for(const weight of [100,900,1500]){
    const document=await shippingDocument();
    const settings={...document.shipping,maxItemsPerParcel:capacity,variantWeights:{[variant]:weight,[second]:400}};
    const lines=[{variant_id:variant,quantity:3},{variant_id:second,quantity:2}];
    const sql=(await db.query<any>("select seen_private.shipping_parcel_plan($1,$2) data",[settings,lines])).rows[0].data;
    const bag:BagQuote={subtotalPence:20000,freeDelivery:true,lines:lines.map(line=>({variantId:line.variant_id,quantity:line.quantity,issue:null,piece:{id:"design-01",name:"Test garment",size:"54",pricePence:4000,photo:{src:"/images/products/design-01/front.webp",alt:"Test garment",label:"Front"}}}))};
    expect(sql).toEqual(parcelsForBag(settings,bag).map(({weightInGrams,quantity})=>({weightInGrams,quantity})));
  }
});

test("multi-parcel checkout reserves the full quantity, charges zero at GBP 80+, and rejects tampered parcel counts or costs",async()=>{
  const document=await shippingDocument(8000);document.shipping.maxItemsPerParcel=1;
  await db.query("update seen_private.site_documents set published=$1,draft=$1 where id",[document]);
  const delivery={id:"standard",label:"Tracked 48",carrier:"Royal Mail",source:"royal_mail_olp",serviceCode:"TEST48",chargePence:0,carrierCostPence:850,weightInGrams:1000,packageFormat:"SmallParcel",expiresAt:Date.now()+300000,
    parcels:[{weightInGrams:500,quantity:1,carrierCostPence:425},{weightInGrams:500,quantity:1,carrierCostPence:425}]};
  const open=async(quote=delivery)=>(await db.query<any>("select public.payment_prepare_order_v3($1,$2,$3,$4,$5,'standard',0,'http://localhost:3000','live',$6,$7,$8) data",
    [requestId,ownerHash,requestHash,details,[{variant_id:variant,quantity:2,unit_price_pence:8000}],quote,document.shipping,document.commerce])).rows[0].data;
  await denied(()=>open({...delivery,parcels:[{...delivery.parcels[0],quantity:2},delivery.parcels[1]]}));
  await denied(()=>open({...delivery,parcels:[delivery.parcels[0]]}));
  await denied(()=>open({...delivery,carrierCostPence:425}));
  await denied(()=>open({...delivery,weightInGrams:900}));
  expect(await stock()).toEqual({on_hand:5,reserved:0});
  const order=await open();expect(order).toMatchObject({subtotal_pence:16000,delivery_pence:0,total_pence:16000,delivery:{carrierCostPence:850,parcels:delivery.parcels}});
  expect(await stock()).toEqual({on_hand:5,reserved:2});
  expect((await open()).id).toBe(order.id);
  await apply(order,"paid","evt_multi_paid");expect(await stock()).toEqual({on_hand:3,reserved:0});
});

test("GBP 80 operator correction preserves private drafts, measurements, products and stock and is idempotent",async()=>{
  const document=await shippingDocument(200);document.commerce.freeDeliveryEnabled=false;
  const draft=structuredClone(document);draft.text["Private test heading"]="Do not publish";
  await db.query("update seen_private.site_documents set draft=$1,published=$2 where id",[draft,document]);
  const script=(await readFile("supabase/enable-free-delivery-80.sql","utf8")).replace(/^begin;$/m,"").replace(/^commit;$/m,"");
  await db.exec(script);
  const read=async()=>(await db.query<any>("select draft,published,version from seen_private.site_documents where id")).rows[0];
  const after=await read();expect(after.published.commerce).toEqual({...document.commerce,freeDeliveryEnabled:true,freeDeliveryThresholdPence:8000});
  expect(after.published.text).not.toHaveProperty("Private test heading");expect(after.draft.text["Private test heading"]).toBe("Do not publish");
  expect(after.published.shipping).toEqual(document.shipping);expect(await stock()).toEqual({on_hand:5,reserved:0});
  await db.exec(script);expect((await read()).version).toBe(after.version);
  await db.exec(await readFile("supabase/migrations/20261023000300_multi_parcel_shipping.sql","utf8").then(s=>s.replace(/^begin;$/m,"").replace(/^commit;$/m,"")));
  expect((await read()).published).toEqual(after.published);
});


async function couponQuote(code="freedel",subtotal=8000,mode="live") {
  return (await db.query<any>("select public.checkout_coupon_quote($1,$2,$3) data",[code,subtotal,mode])).rows[0].data;
}
async function saveCoupon(type="percent",value=10,patch:Record<string,unknown>={}) {
  return (await db.query<any>("insert into seen_private.admin_records(kind,payload) values('coupon',$1) returning id",[
    {code:"SAVE10",type,value,min_subtotal_pence:0,active:true,expires_at:null,usage_limit:null,...patch}
  ])).rows[0].id;
}
async function prepareCoupon(document:typeof defaultDocument,code="freedel",patch:Record<string,unknown>={},id=requestId,mode="live",quantity=1) {
  const coupon=await couponQuote(code,8000*quantity,mode);
  const carrier=document.shipping.mode==="royal_mail_olp";
  const free=document.commerce.freeDeliveryEnabled&&8000*quantity>=document.commerce.freeDeliveryThresholdPence || coupon.freeDelivery;
  const fee=free?0:425;
  const delivery=carrier?{id:"standard",label:"Tracked 48",carrier:"Royal Mail",source:"royal_mail_olp",serviceCode:"TEST48",carrierCostPence:425,chargePence:fee,weightInGrams:100*1+400*quantity,packageFormat:"SmallParcel",expiresAt:Date.now()+300000}:null;
  return (await db.query<any>("select public.payment_prepare_order_v4($1,$2,$3,$4,$5,'standard',$6,'http://localhost:3000',$7,$8,$9,$10,$11,$12) data",[
    id,ownerHash,requestHash,details,[{variant_id:variant,quantity,unit_price_pence:8000}],fee,mode,delivery,carrier?document.shipping:null,document.commerce,code,{...coupon,...patch}
  ])).rows[0].data;
}
async function fixedCouponDocument() {
  const document=structuredClone(defaultDocument);document.commerce.freeDeliveryThresholdPence=10000;
  document.policies={...(document.policies as any),delivery:{...(document.policies as any).delivery,standardChargePence:425}};
  await db.query("update seen_private.site_documents set draft=$1,published=$1 where id",[document]);return document;
}
test("FREEDEL is case insensitive, editable, seeded once and private to trusted coupon checks",async()=>{
  expect(await couponQuote(" freedel ")).toMatchObject({code:"FREEDEL",type:"free_delivery",discountPence:0,freeDelivery:true});
  await db.exec("set local role anon");await denied(()=>couponQuote());await denied(()=>db.query("select * from seen_private.checkout_coupon_uses"));await db.exec("reset role");
  await db.exec("update seen_private.admin_records set payload=payload||'{\"active\":false}'::jsonb where kind='coupon' and payload->>'code'='FREEDEL'");
  await denied(()=>couponQuote());
  const migration=(await readFile("supabase/migrations/20261023000400_checkout_coupons.sql","utf8")).replace(/^begin;$/m,"").replace(/^commit;$/m,"");
  await db.exec(migration);await denied(()=>couponQuote());
});
test("free-delivery code applies below threshold with fixed fees and records the applied code",async()=>{
  const order=await prepareCoupon(await fixedCouponDocument());
  expect(order).toMatchObject({subtotal_pence:8000,discount_pence:0,delivery_pence:0,total_pence:8000,coupon:{code:"FREEDEL"}});
  expect(await stock()).toEqual({on_hand:5,reserved:1});
});
test("percentage and fixed discount snapshots drive exact totals, verified payment and matching emails",async()=>{
  await saveCoupon();const document=await shippingDocument(8000);
  const order=await prepareCoupon(document,"SAVE10");expect(order).toMatchObject({subtotal_pence:8000,discount_pence:800,total_pence:7200,delivery_pence:0});
  await apply(order,"paid","evt_coupon_paid");
  const payload=(await db.query<any>("select payload from seen_private.admin_records where id=$1",[order.id])).rows[0].payload;
  expect(payload).toMatchObject({discount_pence:800,coupon:{code:"SAVE10"},total_pence:7200,payment_status:"paid"});
  const purchase=(await db.query<any>("select snapshot from seen_private.order_emails where order_id=$1 limit 1",[order.id])).rows[0].snapshot;
  expect(emailPurchaseSchema.parse(purchase)).toMatchObject({discount_pence:800,total_pence:7200});
  expect(purchase.items[0].unit_price_pence).toBe(8000);
  await saveCoupon("fixed",125,{code:"LESS125"});expect(await couponQuote("LESS125")).toMatchObject({discountPence:125});
});
test("inactive expired minimum-spend and exhausted codes cannot open checkout or reserve inventory",async()=>{
  for(const patch of [{active:false},{expires_at:"2020-01-01T00:00:00Z"},{min_subtotal_pence:9000}]){
    const id=await saveCoupon("percent",10,patch);await denied(()=>couponQuote("SAVE10"));await db.query("delete from seen_private.admin_records where id=$1",[id]);
  }
  await saveCoupon("percent",100);await denied(()=>couponQuote("SAVE10"));await denied(()=>couponQuote("UNKNOWN"));
  expect(await stock()).toEqual({on_hand:5,reserved:0});
});
test("coupon usage is reserved atomically, retries reuse one claim, failed checkouts release it and test usage is separate",async()=>{
  await saveCoupon("percent",10,{usage_limit:1});const document=await fixedCouponDocument();
  const first=await prepareCoupon(document,"SAVE10");
  const reserveAgain=async(id:string)=>(await db.query<any>("select public.payment_prepare_order_v4($1,$2,$3,$4,$5,'standard',425,'http://localhost:3000','live',null,null,$6,'SAVE10',$7) data",[
    id,ownerHash,requestHash,details,[{variant_id:variant,quantity:1,unit_price_pence:8000}],document.commerce,first.coupon
  ])).rows[0].data;
  expect((await reserveAgain(requestId)).id).toBe(first.id);
  await denied(()=>reserveAgain("50000000-0000-4000-8000-000000000009"));
  const again=(await db.query<any>("select public.payment_get_request($1,$2,$3) data",[requestId,ownerHash,requestHash])).rows[0].data;expect(again.id).toBe(first.id);
  await denied(()=>prepareCoupon(document,"SAVE10",{},"50000000-0000-4000-8000-000000000002"));
  await apply(first,"expired","evt_coupon_expired");
  const second=await prepareCoupon(document,"SAVE10",{},"50000000-0000-4000-8000-000000000003");await apply(second,"paid","evt_coupon_second",{id:"cs_live_coupon_second",payment_intent:"pi_coupon_second"});
  await denied(()=>couponQuote("SAVE10"));expect(await couponQuote("SAVE10",8000,"test")).toMatchObject({discountPence:800});
  expect((await db.query<any>("select state from seen_private.checkout_coupon_uses order by created_at")).rows.map(r=>r.state)).toEqual(["released","used"]);
});
test("a forged discount or changed coupon version never reserves stock",async()=>{
  const document=await fixedCouponDocument();await saveCoupon();
  for(const patch of [{discountPence:7999},{freeDelivery:true},{version:100}])await denied(()=>prepareCoupon(document,"SAVE10",patch));
  expect(await stock()).toEqual({on_hand:5,reserved:0});
});
test("discounted Stripe prices preserve quantities and sum exactly to original merchandise less discount",()=>{
  const items=[{quantity:3,unit_price_pence:101},{quantity:2,unit_price_pence:299}];
  for(const discount of [0,1,10,111,899]){
    const lines=discountedPrices(items,discount);expect(lines.reduce((s,l)=>s+l.quantity*l.unitAmount,0)).toBe(901-discount);
    expect(lines.reduce((s,l)=>s+l.quantity,0)).toBe(5);
  }
});
test("coupon attempts have a durable shared quota independent of an invalid-code rollback",async()=>{
  for(let n=0;n<20;n++)await db.query("select public.checkout_coupon_attempt($1)",[ownerHash]);
  await denied(()=>db.query("select public.checkout_coupon_attempt($1)",[ownerHash]));
  await denied(()=>couponQuote("UNKNOWN"));
  expect((await db.query<any>("select count(*)::int n from seen_private.checkout_coupon_attempts")).rows[0].n).toBe(20);
});


test("the protected admin writer creates and edits free-delivery campaigns while retaining stale-write checks",async()=>{
  const data={code:"NEWFREE",type:"free_delivery",value:0,min_subtotal_pence:0,active:true,expires_at:null,usage_limit:null};
  const id=(await db.query<any>("select public.admin_save_record('coupon',null,$1,0) id",[data])).rows[0].id;
  expect(await couponQuote("newfree")).toMatchObject({id,freeDelivery:true,discountPence:0});
  await db.query("select public.admin_save_record('coupon',$1,$2,1)",[id,{...data,active:false}]);
  await denied(()=>couponQuote("newfree"));
  await denied(()=>db.query("select public.admin_save_record('coupon',$1,$2,1)",[id,data]));
});
