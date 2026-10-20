import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { collectionPieces } from "@/data/collection";
import { parseBagLines, summarizeBag } from "@/lib/bag/model";

const variant = "20000000-0000-4000-8000-000000000001";
let db: PGlite;
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon nologin; create role authenticated nologin;");
  await db.exec(await readFile("supabase/migrations/20261018000100_catalog.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/20261018000200_bag_availability.sql", "utf8"));
  await db.exec(`begin;
    insert into public.products(id,design_reference,name,description,price_pence,status,details_confirmed) values ('10000000-0000-4000-8000-000000000001','design-01','TEST ONLY','TEST ONLY',100,'published',true);
    insert into public.product_variants(id,product_id,size_label) values ('${variant}','10000000-0000-4000-8000-000000000001','TEST S');
    insert into seen_private.inventory(variant_id,on_hand,reserved) values ('${variant}',4,1);
    commit;`);
});
test.afterAll(async () => { await db?.close(); });
test.beforeEach(async () => { await db.exec("begin"); });
test.afterEach(async () => { await db.exec("rollback"); });

test("bag input rejects forged prices, duplicate IDs, invalid quantities and oversized bags", () => {
  expect(parseBagLines([{ variantId: variant, quantity: 2 }])).toEqual([{ variantId: variant, quantity: 2 }]);
  for (const lines of [null, {}, [{ variantId: variant, quantity: 0 }], [{ variantId: variant, quantity: 11 }], [{ variantId: variant, quantity: 1.5 }], [{ variantId: variant, quantity: "2" }], [{ variantId: "invalid", quantity: 1 }], [{ variantId: variant, quantity: 1, pricePence: 1 }], [{ variantId: variant, quantity: 1 }, { variantId: variant.toUpperCase(), quantity: 1 }], Array(21).fill({ variantId: variant, quantity: 1 })]) expect(parseBagLines(lines)).toBeNull();
});

test("delivery includes exactly GBP80 and unavailable lines are excluded from totals", () => {
  const piece = { id: "design-01", name: "TEST ONLY", size: "TEST S", pricePence: 8000, photo: collectionPieces[0].photos[0] };
  const line = { variantId: variant, quantity: 1, piece, issue: null };
  expect(summarizeBag([line]).freeDelivery).toBe(true);
  expect(summarizeBag([{ ...line, piece: { ...piece, pricePence: 7999 } }]).freeDelivery).toBe(false);
  expect(summarizeBag([]).freeDelivery).toBe(false);
  expect(summarizeBag([{ ...line, piece: { ...piece, pricePence: 8001 } }]).freeDelivery).toBe(true);
  expect(summarizeBag([{ ...line, issue: "unavailable" }]).subtotalPence).toBe(0);
});

for (const role of ["anon", "authenticated"]) test(`${role} checks requested quantities without exact stock or writes`, async () => {
  await db.exec(`set local role ${role}`);
  for (const [quantity, available] of [[1, true], [3, true], [4, false], [10, false]]) {
    const result = await db.query("select * from public.check_bag_availability($1::jsonb)", [JSON.stringify([{ variant_id: variant, quantity }])]);
    expect(result.rows).toEqual([{ variant_id: variant, can_fulfil: available }]);
  }
  const missing = "20000000-0000-4000-8000-000000000099";
  expect((await db.query("select * from public.check_bag_availability($1::jsonb)", [JSON.stringify([{ variant_id: missing, quantity: 1 }])])).rows).toEqual([{ variant_id: missing, can_fulfil: false }]);
});

test("SQL rejects malformed or unbounded requests even when called directly", async () => {
  await db.exec("set local role anon");
  for (const payload of [null, {}, [null], [{ variant_id: variant }], [{ variant_id: "bad", quantity: 1 }], [{ variant_id: variant, quantity: 0 }], [{ variant_id: variant, quantity: "1" }], [{ variant_id: variant, quantity: 11 }], [{ variant_id: variant, quantity: 1, on_hand: 100 }], [{ variant_id: variant, quantity: 1 }, { variant_id: variant.toUpperCase(), quantity: 1 }], Array(21).fill({ variant_id: variant, quantity: 1 })]) {
    await db.exec("savepoint malformed");
    await expect(db.query("select * from public.check_bag_availability($1::jsonb)", [JSON.stringify(payload)])).rejects.toMatchObject({ code: "22023" });
    await db.exec("rollback to savepoint malformed");
  }
});

test("draft, inactive and missing-stock sizes fail quantity checks", async () => {
  for (const sql of ["update public.products set status='draft'", "update public.product_variants set active=false", "delete from seen_private.inventory"]) {
    await db.exec("savepoint hidden");
    await db.exec(sql);
    const result = await db.query("select * from public.check_bag_availability($1::jsonb)", [JSON.stringify([{ variant_id: variant, quantity: 1 }])]);
    expect(result.rows).toEqual([{ variant_id: variant, can_fulfil: false }]);
    await db.exec("rollback to savepoint hidden");
  }
  const result = await db.query<{ proconfig: string[]; provolatile: string }>("select proconfig, provolatile from pg_proc where oid='public.check_bag_availability(jsonb)'::regprocedure");
  expect(result.rows[0].proconfig).toContain('search_path=""');
  expect(result.rows[0].provolatile).toBe("s");
});
