import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import release from "../../assets/catalog-release-20261020.json";
import { mapCatalogRows } from "../../src/lib/catalog/contract";
import { collectionPieces } from "../../src/data/collection";

test("catalogue import restores missing designs, protects reservations, preserves identity and cannot reset later edits", async () => {
  test.setTimeout(90_000);
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      alter table storage.objects enable row level security; grant usage on schema storage to anon,authenticated; grant select,insert,delete on storage.objects to anon,authenticated;`);
    for (const name of ["20261018000100_catalog.sql", "20261018000200_bag_availability.sql", "20261019000100_admin.sql", "20261019000200_admin_media.sql", "20261019000300_storefront_sync.sql", "20261019000400_product_delete.sql", "20261019000500_product_visibility.sql", "20261020000100_payments.sql"])
      await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
    await db.exec(await readFile("supabase/seed.sql", "utf8"));
    await db.exec(`delete from public.products where design_reference='design-03';
      update public.products set cost_pence=1234,category='existing-category',photos='[{"src":"/images/extra.webp","label":"Owner upload","alt":"Existing photo"}]' where design_reference='design-01';
      insert into public.product_variants(id,product_id,size_label,sku) select '70000000-0000-4000-8000-000000000054',id,'54','ORIGINAL-SKU' from public.products where design_reference='design-01';
      insert into public.product_variants(product_id,size_label) select id,'52' from public.products where design_reference='design-01';
      insert into seen_private.inventory(variant_id,on_hand,reserved) values('70000000-0000-4000-8000-000000000054',5,1);`);
    const sql = await readFile("supabase/catalog-release-20261020.sql", "utf8");
    await expect(db.exec(sql)).rejects.toThrow(/finish\/cancel open test checkouts/);
    await db.exec("rollback");
    expect((await db.query("select on_hand,reserved from seen_private.inventory")).rows).toEqual([{ on_hand: 5, reserved: 1 }]);
    expect((await db.query("select name from public.products where design_reference='design-01'")).rows[0]).toEqual({ name: null });
    await db.exec("update seen_private.inventory set reserved=0");
    await db.exec(sql);
    const products = (await db.query<any>("select * from public.products order by sort_order")).rows;
    expect(products).toHaveLength(9);
    expect(products[0]).toMatchObject({ name: "Burgundy Roselle Edit", price_pence: 4500, status: "published", cost_pence: 1234, category: "existing-category" });
    expect(products[0].photos).toHaveLength(5);
    expect(products.filter(p=>p.status==='published')).toHaveLength(release.products.filter(p=>p.ready).length);
    expect((await db.query("select sku from public.product_variants where id='70000000-0000-4000-8000-000000000054'")).rows[0]).toEqual({ sku: "ORIGINAL-SKU" });
    const sizes = (await db.query<any>(`select v.size_label,i.on_hand from public.product_variants v join seen_private.inventory i on i.variant_id=v.id
      join public.products p on p.id=v.product_id where p.design_reference='design-01' and v.active order by v.sort_order`)).rows;
    expect(sizes).toEqual([{ size_label: "54", on_hand: 1 }, { size_label: "56", on_hand: 1 }, { size_label: "58", on_hand: 2 }]);
    expect((await db.query("select sum(on_hand)::integer total from seen_private.inventory")).rows[0]).toEqual({ total: 4 });
    expect((await db.query("select count(*)::integer total from public.product_variants where active")).rows[0]).toEqual({ total: 27 });
    expect((await db.query("select active from public.product_variants where size_label='52'")).rows[0]).toEqual({ active: false });
    const backup = (await db.query<any>("select snapshot from seen_private.catalog_import_backups")).rows[0].snapshot;
    expect(backup.products).toHaveLength(6);
    expect(backup.inventory[0]).toMatchObject({ on_hand: 5, reserved: 0 });
    await db.exec(`begin; set local role anon;`);
    const publicRows = (await db.query<{ catalog: unknown[] }>("select public.get_storefront_catalog_v2() as catalog")).rows[0].catalog;
    expect(publicRows).toHaveLength(release.products.filter(p=>p.ready).length);
    const storefront = mapCatalogRows(publicRows, collectionPieces);
    expect(storefront.filter(p=>p.commerce?.variants.some(v=>v.available)).map(p=>p.id)).toEqual(["design-01"]);
    expect(storefront.find(p=>p.id==='design-06')?.commerce?.pricePence).toBe(4500);
    await expect(db.query("select * from seen_private.catalog_import_backups")).rejects.toThrow();
    await db.exec("rollback");
    await db.exec(`update public.products set name='Owner edited' where design_reference='design-01';
      update seen_private.inventory set on_hand=0 where variant_id='70000000-0000-4000-8000-000000000054'`);
    await db.exec(sql);
    expect((await db.query("select name from public.products where design_reference='design-01'")).rows[0]).toEqual({ name: "Owner edited" });
    expect((await db.query("select on_hand from seen_private.inventory where variant_id='70000000-0000-4000-8000-000000000054'")).rows[0]).toEqual({ on_hand: 0 });
    expect((await db.query("select count(*)::integer total from public.products")).rows[0]).toEqual({ total: 9 });
  } finally { await db.close(); }
});
