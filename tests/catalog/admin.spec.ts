import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
import { defaultDocument } from "../../src/lib/cms/model";
import {
  replaceCopy,
  replaceMedia,
  deliveryThresholdFor,
} from "../../src/lib/cms/model";
import {
  productSchema,
  couponSchema,
  csvCell,
  documentRequestSchema,
  type AdminProduct,
} from "../../src/lib/admin/model";
const owner = "10000000-0000-4000-8000-000000000010",
  editor = "10000000-0000-4000-8000-000000000011",
  stranger = "10000000-0000-4000-8000-000000000012";
let db: PGlite;
test.beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
create role anon nologin;create role authenticated nologin;create role service_role nologin;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
`);
  await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
grant usage on schema auth to anon,authenticated;
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
  await db.exec(
    await readFile("supabase/migrations/20261018000100_catalog.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261018000200_bag_availability.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile("supabase/migrations/20261019000100_admin.sql", "utf8"),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261019000200_admin_media.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261019000300_storefront_sync.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261019000400_product_delete.sql",
      "utf8",
    ),
  );
  await db.exec(
    await readFile(
      "supabase/migrations/20261019000500_product_visibility.sql",
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    owner,
    editor,
    stranger,
  ]);
  await db.query(
    "insert into seen_private.admin_members(user_id,role) values($1,'owner'),($2,'editor')",
    [owner, editor],
  );
});
test.afterAll(async () => {
  await db?.close();
});
test.beforeEach(async () => {
  await db.exec("begin;");
});
test.afterEach(async () => {
  await db.exec("rollback;");
});
async function asUser(id: string | null, aal = "aal2", role = "authenticated") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,true)", [
    JSON.stringify(id ? { sub: id, aal } : {}),
  ]);
  await db.exec(`set local role ${role}`);
}
async function denied(sql: string, args: unknown[] = [], code?: string) {
  await db.exec("savepoint refusal");
  const promise = db.query(sql, args);
  if (code) await expect(promise).rejects.toMatchObject({ code });
  else await expect(promise).rejects.toBeDefined();
  await db.exec("rollback to savepoint refusal;release savepoint refusal");
}
async function saveSite(doc = defaultDocument, version = 0, publish = false) {
  return (
    await db.query<{ version: number }>(
      "select public.admin_save_site($1,$2,$3) version",
      [doc, version, publish],
    )
  ).rows[0].version;
}
const product = {
  design_reference: "design-99",
  name: "Test abaya",
  description: "Test description",
  price_pence: 7500,
  cost_pence: 3000,
  status: "published",
  details_confirmed: true,
  sort_order: 1,
  category: "",
  tone: "Red",
  photos: [
    {
      src: "/images/home/hero-poster.webp",
      alt: "Test photograph",
      label: "Front",
    },
  ],
  variants: [{ size_label: "54", sku: "TEST-54", active: true, on_hand: 5 }],
};

async function savedProduct() {
  return (
    await db.query<{ data: { products: AdminProduct[] } }>(
      "select public.admin_snapshot() data",
    )
  ).rows[0].data.products[0];
}
test("bulk visibility publishes complete saved drafts together and hides them without losing stock or private drafts", async () => {
  await asUser(owner);
  const ids: string[] = [];
  for (const [index, status] of ["draft", "archived"].entries()) {
    ids.push(
      (
        await db.query<{ id: string }>(
          "select public.admin_save_product($1,null) id",
          [
            {
              ...product,
              design_reference: `design-${90 + index}`,
              status,
              details_confirmed: false,
              variants: [
                {
                  ...product.variants[0],
                  sku: `BULK-${index}`,
                  on_hand: index,
                },
              ],
            },
          ],
        )
      ).rows[0].id,
    );
  }
  await saveSite({ ...defaultDocument, text: { private: "Unpublished copy" } });
  const revision = (await publicStoreState()).revision;
  await asUser(editor);
  await db.query("select public.admin_bulk_products($1,'publish',null)", [ids]);
  expect((await publicStoreState()).revision).not.toBe(revision);
  await asUser(null, "aal1", "anon");
  const rows = (
    await db.query<{
      rows: {
        design_reference: string;
        price_pence: number;
        variants: { available: boolean }[];
      }[];
    }>("select public.get_storefront_catalog_v2() rows")
  ).rows[0].rows;
  expect(rows).toHaveLength(2);
  expect(rows.every((p) => p.price_pence === product.price_pence)).toBe(true);
  expect(
    rows.find((p) => p.design_reference === "design-90")!.variants[0].available,
  ).toBe(false);
  await asUser(editor);
  await db.query("select public.admin_bulk_products($1,'hide',null)", [ids]);
  const snapshot = (
    await db.query<{
      data: {
        products: AdminProduct[];
        site: { published: unknown; draft: typeof defaultDocument };
      };
    }>("select public.admin_snapshot() data")
  ).rows[0].data;
  expect(
    snapshot.products.every((p) => p.status === "draft" && p.details_confirmed),
  ).toBe(true);
  expect(snapshot.products.map((p) => p.variants[0].on_hand).sort()).toEqual([
    0, 1,
  ]);
  expect(snapshot.site.published).toBeNull();
  expect(snapshot.site.draft.text.private).toBe("Unpublished copy");
  await asUser(null, "aal1", "anon");
  expect(
    (
      await db.query<{ rows: unknown[] }>(
        "select public.get_storefront_catalog_v2() rows",
      )
    ).rows[0].rows,
  ).toEqual([]);
});

test("bulk visibility rejects incomplete products before changing any selected status", async () => {
  await asUser(owner);
  const ready = (
    await db.query<{ id: string }>(
      "select public.admin_save_product($1,null) id",
      [{ ...product, status: "draft", details_confirmed: false }],
    )
  ).rows[0].id;
  const incomplete = (
    await db.query<{ id: string }>(
      "select public.admin_save_product($1,null) id",
      [
        {
          ...product,
          design_reference: "design-98",
          status: "draft",
          details_confirmed: false,
          price_pence: null,
          variants: [{ ...product.variants[0], sku: "INCOMPLETE" }],
        },
      ],
    )
  ).rows[0].id;
  for (const missing of [
    "price_pence=null",
    "name=null",
    "description=null",
    "photos='[]'::jsonb",
  ]) {
    await db.exec("savepoint incomplete_case; reset role");
    await db.query(
      "update public.products set name=$1, description=$2,price_pence=$3,photos=$4 where id=$5",
      [
        product.name,
        product.description,
        product.price_pence,
        product.photos,
        incomplete,
      ],
    );
    await db.exec(
      `update public.products set ${missing} where id='${incomplete}'`,
    );
    await asUser(owner);
    await db.exec("savepoint batch_refusal");
    await expect(
      db.query("select public.admin_bulk_products($1,'publish',null)", [
        [ready, incomplete],
      ]),
    ).rejects.toMatchObject({ message: expect.stringContaining("design-98") });
    await db.exec("rollback to savepoint batch_refusal");
    expect(
      (
        await db.query<{ data: { products: AdminProduct[] } }>(
          "select public.admin_snapshot() data",
        )
      ).rows[0].data.products.every((p) => p.status === "draft"),
    ).toBe(true);
    await db.exec("rollback to savepoint incomplete_case");
  }
  await db.exec("reset role");
  await db.query("update public.products set price_pence=$1 where id=$2", [
    product.price_pence,
    incomplete,
  ]);
  await db.query(
    "update public.product_variants set active=false where product_id=$1",
    [incomplete],
  );
  await asUser(owner);
  await denied("select public.admin_bulk_products($1,'publish',null)", [
    [ready, incomplete],
  ]);
  await db.exec("reset role");
  await db.query(
    "update public.product_variants set active=true where product_id=$1",
    [incomplete],
  );
  await db.query(
    "delete from seen_private.inventory where variant_id in(select id from public.product_variants where product_id=$1)",
    [incomplete],
  );
  await asUser(owner);
  await denied("select public.admin_bulk_products($1,'publish',null)", [
    [ready, incomplete],
  ]);
});

test("bulk visibility requires MFA membership and rejects stale or invalid selections", async () => {
  await asUser(owner);
  await db.query("select public.admin_save_product($1,null)", [
    { ...product, status: "draft", details_confirmed: false },
  ]);
  const saved = await savedProduct();
  for (const [userId, aal, role] of [
    [null, "aal1", "anon"],
    [stranger, "aal2", "authenticated"],
    [owner, "aal1", "authenticated"],
  ] as const) {
    await asUser(userId, aal, role);
    await denied(
      "select public.admin_bulk_products($1,'publish',null)",
      [[saved.id]],
      "42501",
    );
    await denied(
      "select public.admin_bulk_products($1,'hide',null)",
      [[saved.id]],
      "42501",
    );
  }
  await asUser(owner);
  for (const ids of [
    [],
    [saved.id, saved.id],
    [null],
    null,
    Array(501).fill(saved.id),
  ]) {
    await denied("select public.admin_bulk_products($1,'publish',null)", [ids]);
  }
  await denied(
    "select public.admin_bulk_products($1,'publish',null)",
    [[saved.id, stranger]],
    "40001",
  );
  expect((await savedProduct()).status).toBe("draft");
});

test("owner deletion removes an unused product and its sizes without publishing unrelated draft copy", async () => {
  await asUser(owner);
  await db.query("select public.admin_save_product($1,null)", [product]);
  const saved = await savedProduct();
  await saveSite(
    { ...defaultDocument, featured: [product.design_reference] },
    0,
    true,
  );
  await saveSite(
    {
      ...defaultDocument,
      featured: [product.design_reference],
      text: { "Made to": "PRIVATE DRAFT" },
    },
    1,
    false,
  );
  await db.query("select public.admin_delete_product($1,$2)", [
    saved.id,
    saved.updated_at,
  ]);
  await db.exec("set constraints all immediate");
  const snapshot = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data;
  expect(snapshot.products).toEqual([]);
  expect(snapshot.site.draft.text["Made to"]).toBe("PRIVATE DRAFT");
  expect(snapshot.site.published.text["Made to"]).toBeUndefined();
  expect(snapshot.site.published.featured).toEqual([]);
  expect(snapshot.site.draft.featured).toEqual([]);
  expect(
    snapshot.audit.some(
      (a: any) => a.action === "delete" && a.entity === "product",
    ),
  ).toBe(true);
  await db.exec("reset role");
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from seen_private.inventory",
      )
    ).rows[0].count,
  ).toBe(0);
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int count from public.product_variants",
      )
    ).rows[0].count,
  ).toBe(0);
});
test("permanent deletion requires an owner with MFA and the latest product revision", async () => {
  await asUser(owner);
  await db.query("select public.admin_save_product($1,null)", [product]);
  const saved = await savedProduct();
  for (const [id, aal, role] of [
    [null, "aal1", "anon"],
    [stranger, "aal2", "authenticated"],
    [editor, "aal2", "authenticated"],
    [owner, "aal1", "authenticated"],
  ] as const) {
    await asUser(id, aal, role);
    await denied(
      "select public.admin_delete_product($1,$2)",
      [saved.id, saved.updated_at],
      "42501",
    );
  }
  await asUser(owner);
  await denied(
    "select public.admin_delete_product($1,$2)",
    [saved.id, "2020-01-01T00:00:00Z"],
    "40001",
  );
  expect((await savedProduct()).id).toBe(saved.id);
});
test("deletion refuses reserved stock and order references and leaves the product intact", async () => {
  await asUser(owner);
  await db.query("select public.admin_save_product($1,null)", [product]);
  let saved = await savedProduct();
  await db.exec("reset role");
  await db.query(
    "update seen_private.inventory set reserved=1 where variant_id=$1",
    [saved.variants[0].id],
  );
  await asUser(owner);
  saved = await savedProduct();
  await denied("select public.admin_delete_product($1,$2)", [
    saved.id,
    saved.updated_at,
  ]);
  await db.exec("reset role");
  await db.query(
    "update seen_private.inventory set reserved=0 where variant_id=$1",
    [saved.variants[0].id],
  );
  await db.query(
    "insert into seen_private.admin_records(kind,payload) values('order',$1)",
    [{ items: [{ variantId: saved.variants[0].id }] }],
  );
  await asUser(owner);
  saved = await savedProduct();
  await denied("select public.admin_delete_product($1,$2)", [
    saved.id,
    saved.updated_at,
  ]);
  expect((await savedProduct()).id).toBe(saved.id);
});
test("reusable page media stays private in drafts and is readable only after publication", async () => {
  await db.exec("reset role");
  const name = "00000000-0000-4000-8000-000000000077.mp4";
  await db.query(
    "insert into storage.objects(bucket_id,name) values('seen-media',$1)",
    [name],
  );
  const doc = {
    ...defaultDocument,
    sections: [
      {
        id: "00000000-0000-4000-8000-000000000078",
        page: "/our-story",
        position: "after" as const,
        src: `/api/media/${name}`,
        poster: "",
        alt: "A brand film",
        caption: "Test caption",
        aspect: "landscape" as const,
      },
    ],
  };
  await asUser(owner);
  await saveSite(doc, 0, false);
  await asUser(null, "aal1", "anon");
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select public.is_published_seen_media($1) ok",
        [name],
      )
    ).rows[0].ok,
  ).toBe(false);
  await asUser(owner);
  await saveSite(doc, 1, true);
  await asUser(null, "aal1", "anon");
  expect(
    (
      await db.query<{ ok: boolean }>(
        "select public.is_published_seen_media($1) ok",
        [name],
      )
    ).rows[0].ok,
  ).toBe(true);
  expect(
    documentRequestSchema.safeParse({
      document: doc,
      version: 2,
      publish: true,
    }).success,
  ).toBe(true);
  expect(
    documentRequestSchema.safeParse({
      document: {
        ...doc,
        sections: [{ ...doc.sections[0], page: "/admin/security" }],
      },
      version: 2,
      publish: true,
    }).success,
  ).toBe(false);
});

async function publicStoreState() {
  return (
    await db.query<{
      state: {
        revision: string;
        categories: { slug: string; name: string; description: string }[];
      };
    }>("select public.get_storefront_state() state")
  ).rows[0].state;
}

test("public category navigation includes empty categories, preserves order and exposes no private records", async () => {
  await asUser(owner);
  for (const category of [
    {
      name: "Evening",
      slug: "evening",
      description: "Occasion pieces",
      sort_order: 2,
    },
    {
      name: "Everyday",
      slug: "everyday",
      description: "Daily pieces",
      sort_order: 1,
    },
  ])
    await db.query("select public.admin_save_record('category',null,$1,0)", [
      category,
    ]);
  await db.query("select public.admin_save_record('expense',null,$1,0)", [
    {
      title: "Private expense",
      amount_pence: 1200,
      date: "2026-10-19",
      note: "Private",
    },
  ]);
  await asUser(null, "aal1", "anon");
  const state = await publicStoreState();
  expect(state.categories).toEqual([
    { slug: "everyday", name: "Everyday", description: "Daily pieces" },
    { slug: "evening", name: "Evening", description: "Occasion pieces" },
  ]);
  expect(Object.keys(state).sort()).toEqual(["categories", "revision"]);
  await denied("select * from seen_private.storefront_state", [], "42501");
  await denied(
    "update seen_private.storefront_state set revision=gen_random_uuid()",
    [],
    "42501",
  );
});

test("store revisions follow publication, categories, visible products and inventory without publishing drafts", async () => {
  await asUser(owner);
  const first = (await publicStoreState()).revision;
  await saveSite(defaultDocument, 0, false);
  expect((await publicStoreState()).revision).toBe(first);
  const draft = (
    await db.query<{ id: string }>(
      "select public.admin_save_product($1,null) id",
      [{ ...product, status: "draft", details_confirmed: false }],
    )
  ).rows[0].id;
  expect((await publicStoreState()).revision).toBe(first);
  await db.query("select public.admin_save_record('expense',null,$1,0)", [
    { title: "Private", amount_pence: 1000, date: "2026-10-19", note: "" },
  ]);
  expect((await publicStoreState()).revision).toBe(first);
  await saveSite(defaultDocument, 1, true);
  let revision = (await publicStoreState()).revision;
  expect(revision).not.toBe(first);
  await asUser(null, "aal1", "anon");
  expect(
    (
      await db.query<{ rows: unknown[] }>(
        "select public.get_storefront_catalog_v2() rows",
      )
    ).rows[0].rows,
  ).toEqual([]);
  await asUser(owner);
  const saved = (
    await db.query<{ snapshot: { products: AdminProduct[] } }>(
      "select public.admin_snapshot() snapshot",
    )
  ).rows[0].snapshot.products.find((p) => p.id === draft)!;
  await db.query("select public.admin_save_product($1,$2)", [
    {
      ...product,
      id: draft,
      variants: saved.variants.map((v) => ({
        id: v.id,
        size_label: v.size_label,
        sku: v.sku,
        active: v.active,
        on_hand: v.on_hand,
      })),
    },
    saved.updated_at,
  ]);
  expect((await publicStoreState()).revision).not.toBe(revision);
  revision = (await publicStoreState()).revision;
  await db.query("select public.admin_bulk_products($1,'stock',2)", [[draft]]);
  expect((await publicStoreState()).revision).not.toBe(revision);
  revision = (await publicStoreState()).revision;
  await db.query("select public.admin_bulk_products($1,'archive',null)", [
    [draft],
  ]);
  expect((await publicStoreState()).revision).not.toBe(revision);
});

test("anonymous and ordinary authenticated users cannot access admin functions, costs or private tables", async () => {
  for (const [id, role] of [
    [null, "anon"],
    [stranger, "authenticated"],
  ] as const) {
    await asUser(id, "aal2", role);
    await denied("select public.admin_snapshot()", [], "42501");
    await denied("select * from seen_private.admin_members", [], "42501");
    await denied("select * from seen_private.admin_records", [], "42501");
    await denied("select cost_pence from public.products", [], "42501");
    await denied("select sku from public.product_variants", [], "42501");
    await denied(
      "select public.admin_save_product($1,null)",
      [product],
      "42501",
    );
    await denied(
      "select public.record_verified_enquiry(gen_random_uuid(),'{}')",
      [],
      "42501",
    );
    expect(
      (await db.query("select public.get_site_document() doc")).rows,
    ).toEqual([{ doc: null }]);
  }
});
test("MFA and active membership are required even for a known administrator", async () => {
  await asUser(owner, "aal1");
  expect(
    (await db.query<any>("select public.admin_access() access")).rows[0].access,
  ).toMatchObject({ allowed: true, mfa: false });
  await denied("select public.admin_snapshot()", [], "42501");
  await asUser(owner);
  expect(
    (await db.query<any>("select public.admin_access() access")).rows[0].access
      .mfa,
  ).toBe(true);
  await db.exec("reset role");
  await db.query(
    "update seen_private.admin_members set active=false where user_id=$1",
    [owner],
  );
  await asUser(owner);
  await denied("select public.admin_snapshot()", [], "42501");
});
test("drafts stay private, publication is explicit, stale writes conflict and revisions restore into drafts", async () => {
  await asUser(owner);
  expect(await saveSite()).toBe(1);
  await asUser(null, "aal1", "anon");
  expect(
    (await db.query<any>("select public.get_site_document() doc")).rows[0].doc,
  ).toBeNull();
  await asUser(owner);
  const first = { ...defaultDocument, text: { "Made to": "Designed to" } };
  expect(await saveSite(first, 1, true)).toBe(2);
  await denied(
    "select public.admin_save_site($1,1,true)",
    [defaultDocument],
    "40001",
  );
  expect(await saveSite(defaultDocument, 2, true)).toBe(3);
  await db.query("select public.admin_restore_site(2,3)");
  const snap = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data;
  expect(snap.site.draft.text).toEqual(first.text);
  expect(snap.site.published.text).toEqual({});
  expect(snap.history).toHaveLength(2);
  await asUser(null, "aal1", "anon");
  expect(
    (await db.query<any>("select public.get_site_document() doc")).rows[0].doc
      .text,
  ).toEqual({});
});
test("editors can edit copy, but cannot alter legal settings or read customer records", async () => {
  await asUser(owner);
  await saveSite();
  await db.exec("reset role");
  await db.exec(
    "insert into seen_private.admin_records(kind,payload) values('message','{\"email\":\"private@example.test\"}')",
  );
  await asUser(editor);
  const snap = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data;
  expect(snap.records).toEqual([]);
  await saveSite({ ...defaultDocument, text: { hello: "world" } }, 1);
  await denied(
    "select public.admin_save_site($1,2,false)",
    [{ ...defaultDocument, policies: {} }],
    "42501",
  );
  await denied(
    "select public.admin_save_record('expense',null,$1,0)",
    [{ title: "x", amount_pence: 100 }],
    "42501",
  );
});
test("draft variants without inventory remain editable without creating duplicate sizes", async () => {
  const pid = (
    await db.query<any>(
      "insert into public.products(design_reference) values('design-99') returning id",
    )
  ).rows[0].id;
  const vid = (
    await db.query<any>(
      "insert into public.product_variants(product_id,size_label) values($1,'54') returning id",
      [pid],
    )
  ).rows[0].id;
  await asUser(owner);
  const before = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data.products[0];
  expect(before.variants).toHaveLength(1);
  expect(before.variants[0]).toMatchObject({
    id: vid,
    on_hand: 0,
    inventory_known: false,
  });
  await db.query("select public.admin_save_product($1,$2)", [
    {
      ...product,
      id: pid,
      status: "draft",
      details_confirmed: false,
      variants: [{ ...product.variants[0], id: vid, on_hand: 5 }],
    },
    before.updated_at,
  ]);
  const after = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data.products[0];
  expect(after.variants).toHaveLength(1);
  expect(after.variants[0]).toMatchObject({
    id: vid,
    on_hand: 5,
    inventory_known: true,
  });
});

test("product saves are atomic, support new photography and protect reserved stock", async () => {
  await asUser(owner);
  const id = (
    await db.query<any>("select public.admin_save_product($1,null) id", [
      product,
    ])
  ).rows[0].id;
  await db.exec("set constraints all immediate");
  await asUser(null, "aal1", "anon");
  const rows = (
    await db.query<any>("select public.get_storefront_catalog_v2() data")
  ).rows[0].data;
  expect(rows[0]).toMatchObject({
    design_reference: "design-99",
    photos: product.photos,
  });
  expect(JSON.stringify(rows)).not.toMatch(
    /cost_pence|on_hand|reserved|TEST-54/,
  );
  await asUser(owner);
  const snap = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data;
  const saved = snap.products[0];
  await db.exec("reset role");
  await db.query(
    "update seen_private.inventory set reserved=3 where variant_id=$1",
    [saved.variants[0].id],
  );
  await asUser(owner);
  await denied(
    "select public.admin_bulk_products($1,'stock',2)",
    [[id]],
    "23514",
  );
  await denied(
    "select public.admin_save_product($1,null)",
    [{ ...product, id }],
    "40001",
  );
  await denied(
    "select public.admin_save_product($1,$2)",
    [
      {
        ...product,
        id,
        variants: [
          { ...product.variants[0], id: saved.variants[0].id, on_hand: 1 },
        ],
      },
      saved.updated_at,
    ],
    "40001",
  );
  expect(
    (await db.query<any>("select public.admin_snapshot() data")).rows[0].data
      .products[0].variants[0].on_hand,
  ).toBe(5);
});
test("admin cannot forge paid orders, create customer messages or fulfil an unverified payment", async () => {
  await asUser(owner);
  await denied("select public.admin_save_record('order',null,$1,0)", [
    { status: "completed", payment_status: "paid" },
  ]);
  await db.exec("reset role");
  const id = (
    await db.query<any>(
      'insert into seen_private.admin_records(kind,payload) values(\'order\',\'{"status":"pending","total_pence":7500}\') returning id',
    )
  ).rows[0].id;
  await asUser(owner);
  await denied("select public.admin_save_record('order',$1,$2,1)", [
    id,
    { status: "completed", tracking: "", notes: "" },
  ]);
  await denied("select public.admin_save_record('order',$1,$2,1)", [
    id,
    { status: "pending", payment_status: "paid" },
  ]);
  await denied("select public.admin_delete_record($1,1)", [id]);
});
test("private uploads are unreadable publicly until referenced by published content", async () => {
  const name = "00000000-0000-4000-8000-000000000001.webp";
  await asUser(owner);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('seen-media',$1)",
    [name],
  );
  const document = {
    ...defaultDocument,
    hero: { ...defaultDocument.hero, poster: `/api/media/${name}` },
  };
  await saveSite(document);
  await asUser(null, "aal1", "anon");
  expect((await db.query("select name from storage.objects")).rows).toEqual([]);
  await denied(
    "insert into storage.objects(bucket_id,name) values('seen-media','bad.webp')",
    [],
    "42501",
  );
  await asUser(owner);
  await saveSite(document, 1, true);
  await asUser(null, "aal1", "anon");
  expect(
    (await db.query("select name from storage.objects")).rows,
  ).toHaveLength(1);
  await asUser(owner);
  expect(
    (await db.query("delete from storage.objects returning name")).rows,
  ).toEqual([]);
});
test("missing uploaded assets cannot be saved or published", async () => {
  await asUser(owner);
  await denied("select public.admin_save_site($1,0,true)", [
    {
      ...defaultDocument,
      hero: {
        ...defaultDocument.hero,
        poster: "/api/media/00000000-0000-4000-8000-000000000099.webp",
      },
    },
  ]);
});
test("category renames update assigned products and assigned categories cannot be deleted", async () => {
  await asUser(owner);
  const category = {
    name: "Evening",
    slug: "evening",
    description: "",
    sort_order: 0,
  };
  const id = (
    await db.query<any>(
      "select public.admin_save_record('category',null,$1,0) id",
      [category],
    )
  ).rows[0].id;
  await db.query("select public.admin_save_product($1,null)", [
    { ...product, category: "evening" },
  ]);
  await db.query("select public.admin_save_record('category',$1,$2,1)", [
    id,
    { ...category, name: "Occasion", slug: "occasion" },
  ]);
  await denied("select public.admin_delete_record($1,2)", [id]);
  await asUser(null, "aal1", "anon");
  expect(
    (await db.query<any>("select public.get_storefront_catalog_v2() data"))
      .rows[0].data[0],
  ).toMatchObject({ category: "occasion", category_name: "Occasion" });
});
test("copy dictionaries preserve prototype-named strings and never rewrite financial amounts", () => {
  const document = {
    ...defaultDocument,
    commerce: { ...defaultDocument.commerce, freeDeliveryThresholdPence: 9000 },
  };
  expect(replaceCopy("constructor", document)).toBe("constructor");
  expect(replaceMedia("toString", document)).toBe("toString");
  expect(replaceCopy("Delivery over £80; price £800.", document)).toBe(
    "Delivery over £80; price £800.",
  );
  expect(deliveryThresholdFor(document)).toBe("£90");
});

test("financial totals include older records beyond the bounded operational list", async () => {
  await db.exec(
    "insert into seen_private.admin_records(kind,payload) select 'expense',jsonb_build_object('title','Test expense','amount_pence',100,'date','2026-10-19','note','') from generate_series(1,1001)",
  );
  await asUser(owner);
  const snapshot = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data;
  expect(snapshot.records).toHaveLength(1000);
  expect(snapshot.statistics).toMatchObject({
    recordCount: 1001,
    expensePence: 100100,
    paidPence: 0,
  });
});
test("inbox ingestion is restricted to the trusted server and idempotent", async () => {
  await asUser(null, "aal1", "service_role");
  const input = {
    name: "Test Customer",
    email: "test@example.test",
    phone: "07700900123",
    message: "A test message for the store.",
  };
  for (let i = 0; i < 2; i++)
    await db.query("select public.record_verified_enquiry($1,$2)", [
      stranger,
      input,
    ]);
  await asUser(owner);
  const snap = (await db.query<any>("select public.admin_snapshot() data"))
    .rows[0].data;
  expect(snap.records).toHaveLength(1);
  expect(snap.records[0].payload).toMatchObject({
    read: false,
    archived: false,
    email: input.email,
  });
});
test("request validation rejects unsafe media, arbitrary scripts, invalid prices and invalid percentages", () => {
  expect(
    documentRequestSchema.safeParse({
      document: {
        ...defaultDocument,
        hero: {
          videos: ["javascript:alert(1)"],
          poster: "/images/home/hero-poster.webp",
        },
      },
      version: 0,
      publish: true,
    }).success,
  ).toBe(false);
  expect(productSchema.safeParse({ ...product, price_pence: -1 }).success).toBe(
    false,
  );
  expect(
    couponSchema.safeParse({
      code: "TEST",
      type: "percent",
      value: 101,
      min_subtotal_pence: 0,
      active: true,
      expires_at: null,
      usage_limit: null,
    }).success,
  ).toBe(false);
  expect(csvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  expect(csvCell("ordinary")).toBe('"ordinary"');
});
