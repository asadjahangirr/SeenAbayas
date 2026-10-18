import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

let db: PGlite;
const productId = "10000000-0000-4000-8000-000000000001";
const firstVariant = "20000000-0000-4000-8000-000000000001";
const secondVariant = "20000000-0000-4000-8000-000000000002";

test.beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon nologin; create role authenticated nologin;");
  await db.exec(await readFile("supabase/migrations/20261018000100_catalog.sql", "utf8"));
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
});
test.afterAll(async () => { await db?.close(); });
test.beforeEach(async () => { await db.exec("begin"); });
test.afterEach(async () => { await db.exec("rollback"); });

async function rejected(sql: string, code = "42501") {
  await db.exec("savepoint denied_operation");
  await expect(db.exec(sql)).rejects.toMatchObject({ code });
  await db.exec("rollback to savepoint denied_operation; release savepoint denied_operation");
}

async function publishedFixture() {
  // Synthetic test-only merchandise. Never imported into the storefront or seed.
  await db.query("update public.products set id=$1, name='TEST ONLY Burgundy', description='TEST ONLY description', price_pence=12345, details_confirmed=true, status='published' where design_reference='design-01'", [productId]);
  await db.query("insert into public.product_variants(id,product_id,size_label,sku,sort_order) values ($1,$3,'TEST S','TEST-S',1),($2,$3,'TEST M','TEST-M',2)", [firstVariant, secondVariant, productId]);
  await db.query("insert into seen_private.inventory(variant_id,on_hand,reserved) values ($1,3,1),($2,0,0)", [firstVariant, secondVariant]);
  await db.exec("set constraints all immediate");
}

test("seed creates seven private drafts with no guessed commercial details", async () => {
  const { rows } = await db.query("select status, name, price_pence, details_confirmed from public.products");
  expect(rows).toHaveLength(7);
  expect(rows.every((row: any) => row.status === "draft" && row.name === null && row.price_pence === null && row.details_confirmed === false)).toBe(true);
  expect((await db.query("select * from public.product_variants")).rows).toEqual([]);
  expect((await db.query("select * from seen_private.inventory")).rows).toEqual([]);
  await db.exec("set local role anon");
  expect((await db.query("select * from public.products")).rows).toEqual([]);
  expect((await db.query("select * from public.get_storefront_catalog()")).rows).toEqual([]);
});

test("reseeding preserves confirmed details and does not duplicate references", async () => {
  await db.exec("update public.products set name='TEST ONLY preserved' where design_reference='design-01'");
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  expect((await db.query("select id from public.products")).rows).toHaveLength(7);
  expect((await db.query("select name from public.products where design_reference='design-01'")).rows).toEqual([{ name: "TEST ONLY preserved" }]);
});

for (const role of ["anon", "authenticated"]) {
  test(`${role} reads only published products and active sizes, with availability instead of stock counts`, async () => {
    await publishedFixture();
    await db.exec("insert into public.product_variants(product_id,size_label,active) values ('10000000-0000-4000-8000-000000000001','TEST inactive',false)");
    await db.exec(`set local role ${role}`);
    expect((await db.query("select name from public.products")).rows).toEqual([{ name: "TEST ONLY Burgundy" }]);
    expect((await db.query("select size_label from public.product_variants order by sort_order")).rows).toEqual([{ size_label: "TEST S" }, { size_label: "TEST M" }]);
    const { rows } = await db.query<any>("select * from public.get_storefront_catalog()");
    expect(rows).toHaveLength(1);
    expect(rows[0].variants).toEqual([
      { id: firstVariant, size_label: "TEST S", available: true },
      { id: secondVariant, size_label: "TEST M", available: false },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/on_hand|reserved|TEST-S|TEST-M/);
  });

  test(`${role} cannot create, edit or delete catalog records or read private inventory`, async () => {
    await publishedFixture();
    await db.exec(`set local role ${role}`);
    for (const sql of [
      "insert into public.products(design_reference) values ('design-99')",
      "update public.products set price_pence=1",
      "delete from public.products",
      "insert into public.product_variants(product_id,size_label) values ('10000000-0000-4000-8000-000000000001','FORGED')",
      "update public.product_variants set active=false",
      "delete from public.product_variants",
      "select * from seen_private.inventory",
      "update seen_private.inventory set on_hand=999",
      "select seen_private.assert_product_ready('10000000-0000-4000-8000-000000000001')",
    ]) await rejected(sql);
  });
}

test("publication rejects missing product facts, sizes and unknown stock", async () => {
  await rejected("update public.products set status='published' where design_reference='design-01'", "23514");
  await db.exec("update public.products set name='TEST ONLY', description='TEST ONLY', price_pence=100, details_confirmed=true, status='published' where design_reference='design-01'");
  await rejected("set constraints all immediate", "23514");
  const { rows } = await db.query<{ id: string }>("select id from public.products where design_reference='design-01'");
  await db.query("insert into public.product_variants(id,product_id,size_label) values ($1,$2,'TEST SIZE')", [firstVariant, rows[0].id]);
  await rejected("set constraints all immediate", "23514");
  await db.query("insert into seen_private.inventory(variant_id,on_hand) values ($1,0)", [firstVariant]);
  await db.exec("set constraints all immediate; set local role anon");
  const result = await db.query<any>("select * from public.get_storefront_catalog()");
  expect(result.rows[0].variants[0].available).toBe(false);
});

test("stock cannot become negative or reserve more than the recorded quantity", async () => {
  await publishedFixture();
  await rejected(`update seen_private.inventory set on_hand=-1 where variant_id='${firstVariant}'`, "23514");
  await rejected(`update seen_private.inventory set reserved=4 where variant_id='${firstVariant}'`, "23514");
  await rejected(`update seen_private.inventory set reserved=-1 where variant_id='${firstVariant}'`, "23514");
  await db.exec(`update seen_private.inventory set reserved=on_hand where variant_id='${firstVariant}'; set local role anon`);
  expect((await db.query<any>("select * from public.get_storefront_catalog()")).rows[0].variants.every((item: any) => !item.available)).toBe(true);
});

test("published catalog integrity survives variant and inventory mutations", async () => {
  await publishedFixture();
  await rejected("update public.product_variants set active=false", "23514");
  await rejected(`delete from seen_private.inventory where variant_id='${firstVariant}'`, "23514");
  await rejected("update public.products set details_confirmed=false where status='published'", "23514");
  await db.exec("update public.products set status='archived' where status='published'; set local role authenticated");
  expect((await db.query("select * from public.get_storefront_catalog()")).rows).toEqual([]);
});

test("prices, currency and duplicate size labels are constrained by PostgreSQL", async () => {
  await publishedFixture();
  await rejected("update public.products set price_pence=0", "23514");
  await rejected("update public.products set price_pence=-1", "23514");
  await rejected("update public.products set currency='USD'", "23514");
  await rejected(`insert into public.product_variants(product_id,size_label) values ('${productId}','test s')`, "23505");
});

test("all catalog tables use RLS and definer functions have a fixed search path", async () => {
  const tables = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where oid in ('public.products'::regclass,'public.product_variants'::regclass,'seen_private.inventory'::regclass)");
  expect(tables.rows).toHaveLength(3);
  expect(tables.rows.every((row) => row.relrowsecurity)).toBe(true);
  const functions = await db.query<{ proconfig: string[] }>("select proconfig from pg_proc where prosecdef and pronamespace in ('public'::regnamespace,'seen_private'::regnamespace)");
  expect(functions.rows).toHaveLength(3);
  expect(functions.rows.every((row) => row.proconfig.includes('search_path=""'))).toBe(true);
});
