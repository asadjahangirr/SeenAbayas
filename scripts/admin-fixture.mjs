// Test-only provider simulator. Never imported by the application or deployed.
import http from "node:http";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const owner = "10000000-0000-4000-8000-000000000010";
const factor = "10000000-0000-4000-8000-000000000020";
const challenge = "10000000-0000-4000-8000-000000000021";
const url = "http://127.0.0.1:3106";
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
])
  await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
await db.query("insert into auth.users(id) values($1)", [owner]);
await db.query(
  "insert into seen_private.admin_members(user_id,role) values($1,'owner')",
  [owner],
);
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "owner@example.test",
  email_confirmed_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: new Date().toISOString(),
  factors: [
    {
      id: factor,
      factor_type: "totp",
      status: "verified",
      friendly_name: "Test authenticator",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
};
function session(aal = "aal1") {
  const now = Math.floor(Date.now() / 1000);
  const part = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
  const unsigned = `${part({ alg: "HS256", typ: "JWT" })}.${part({ iss: `${url}/auth/v1`, sub: owner, aud: "authenticated", role: "authenticated", aal, iat: now, exp: now + 3600, session_id: challenge })}`;
  return {
    access_token: `${unsigned}.${createHmac("sha256", "TEST-ONLY-NOT-A-PRODUCTION-SECRET").update(unsigned).digest("base64url")}`,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `test-refresh-${aal}`,
    user,
  };
}
const knownTokens = new Map();
function mint(aal) {
  const s = session(aal);
  knownTokens.set(s.access_token, aal);
  return s;
}
let queue = Promise.resolve();
function serial(fn) {
  const next = queue.then(fn);
  queue = next.catch(() => {});
  return next;
}
const rpc = {
  admin_access: [],
  admin_snapshot: [],
  get_site_document: [],
  get_storefront_state: [],
  get_storefront_catalog_v2: [],
  admin_save_site: ["document", "expected_version", "publish"],
  admin_restore_site: ["target_version", "expected_version"],
  admin_save_product: ["product", "expected_updated_at"],
  admin_delete_product: ["product_id", "expected_updated_at"],
  admin_bulk_products: ["ids", "operation", "quantity"],
  admin_save_record: ["record_kind", "record_id", "data", "expected_version"],
  admin_delete_record: ["record_id", "expected_version"],
  is_published_seen_media: ["object_name"],
  check_bag_availability: ["requested_lines"],
};
let recoveryIssued = false;
async function reset(enroll = false) {
  user.factors = enroll
    ? []
    : [
        {
          id: factor,
          factor_type: "totp",
          status: "verified",
          friendly_name: "Test authenticator",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
  knownTokens.clear();
  recoveryIssued = false;
  uploads.clear();
  uploadNames.clear();
  await db.exec(
    "reset role;delete from seen_private.admin_records;delete from seen_private.admin_audit;delete from seen_private.site_history;update seen_private.site_documents set version=0,draft='{}',published=null,published_at=null;delete from seen_private.inventory;delete from public.product_variants;delete from public.products;delete from storage.objects;",
  );
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: owner, aal: "aal2" }),
  ]);
  const media = JSON.parse(
    await readFile("src/data/media.generated.json", "utf8"),
  );
  const demo = JSON.parse(
    await readFile("src/data/development-catalog.json", "utf8"),
  );
  for (const [i, p] of demo.products.entries()) {
    await db.query("select public.admin_save_product($1,null)", [
      {
        design_reference: p.designReference,
        name: p.name,
        description: "Test-only abaya description.",
        price_pence: p.pricePence,
        cost_pence: null,
        status: i === 0 ? "published" : "draft",
        details_confirmed: i === 0,
        sort_order: i,
        photos: media.pieces.find((ph) => ph.id === p.designReference).photos,
        category: "",
        tone: i === 0 ? "Burgundy" : "Black",
        variants: [
          { size_label: "54", sku: `TEST-${i}`, active: true, on_hand: 5 },
        ],
      },
    ]);
  }
  await db.query(
    "insert into seen_private.admin_records(kind,payload) values('message',$1),('order',$2)",
    [
      {
        name: "Test Customer",
        email: "customer@example.test",
        phone: "07700900123",
        message: "Could you help with sizing, please?",
        read: false,
        archived: false,
        notes: "",
      },
      {
        order_number: "TEST-1001",
        name: "Test Customer",
        email: "customer@example.test",
        total_pence: 7500,
        payment_status: "paid",
        status: "confirmed",
        tracking: "",
        notes: "",
      },
    ],
  );
}
const uploads = new Map();
const uploadNames = new Map();
await reset();
const server = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, url).pathname;
  const send = (body, status = 200, headers = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "http://127.0.0.1:3107",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info,x-upsert,cache-control,x-metadata",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      ...headers,
    });
    res.end(JSON.stringify(body));
  };
  if (req.method === "OPTIONS") {
    send({});
    return;
  }
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    let body = {};
    if (req.headers["content-type"]?.includes("application/json"))
      body = JSON.parse(raw.toString() || "{}");
    const bearer = req.headers.authorization?.replace(/^Bearer /, "");
    const aal = knownTokens.get(bearer);
    if (pathname === "/__test/reset") {
      await serial(() =>
        reset(new URL(req.url, url).searchParams.has("enroll")),
      );
      send({ ok: true });
      return;
    }
    if (pathname === "/auth/v1/recover") {
      recoveryIssued = body.email === "owner@example.test";
      send({});
      return;
    }
    if (pathname === "/auth/v1/token") {
      if (body.auth_code) {
        if (
          body.auth_code !== "test-recovery-code" ||
          !body.code_verifier ||
          !recoveryIssued
        ) {
          send({ message: "Invalid recovery code" }, 400);
          return;
        }
        recoveryIssued = false;
        send(mint("aal1"));
        return;
      }
      if (body.grant_type === "refresh_token" || body.refresh_token) {
        send(
          mint(String(body.refresh_token).endsWith("aal2") ? "aal2" : "aal1"),
        );
        return;
      }
      if (
        body.email !== "owner@example.test" ||
        body.password !== "Test-password-only-123"
      ) {
        send(
          { error: "invalid_grant", error_description: "Invalid credentials" },
          400,
        );
        return;
      }
      send(mint("aal1"));
      return;
    }
    if (pathname === "/auth/v1/user") {
      if (!aal) {
        send({ message: "Invalid token" }, 401);
        return;
      }
      if (
        req.method === "PUT" &&
        (aal !== "aal2" ||
          (!body.email && !body.password) ||
          (body.password && body.password.length < 14))
      ) {
        send({ message: "Invalid account update" }, 400);
        return;
      }
      send(user);
      return;
    }
    if (pathname === "/auth/v1/logout") {
      knownTokens.delete(bearer);
      send({});
      return;
    }
    if (pathname === "/auth/v1/factors" && req.method === "POST") {
      if (!aal) {
        send({}, 401);
        return;
      }
      user.factors = [
        {
          id: factor,
          factor_type: "totp",
          status: "unverified",
          friendly_name: "Test authenticator",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
      send({
        id: factor,
        type: "totp",
        totp: {
          qr_code:
            '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="white"/><text x="10" y="90">TEST QR ONLY</text></svg>',
          secret: "TESTONLYNOTAPRODUCTIONSECRET",
          uri: "otpauth://totp/Test?secret=TESTONLY",
        },
      });
      return;
    }
    if (pathname === `/auth/v1/factors/${factor}/challenge`) {
      if (!aal) {
        send({}, 401);
        return;
      }
      send({
        id: challenge,
        type: "totp",
        expires_at: Math.floor(Date.now() / 1000) + 300,
      });
      return;
    }
    if (pathname === `/auth/v1/factors/${factor}/verify`) {
      if (!aal || body.code !== "123456") {
        send({ message: "Invalid code" }, 400);
        return;
      }
      user.factors = user.factors.map((f) => ({ ...f, status: "verified" }));
      send(mint("aal2"));
      return;
    }
    if (pathname.startsWith("/rest/v1/rpc/")) {
      const name = pathname.split("/").pop();
      if (!(name in rpc)) {
        send({ code: "42883", message: "Unknown function" }, 404);
        return;
      }
      const result = await serial(async () => {
        await db.exec("begin");
        try {
          await db.query("select set_config('request.jwt.claims',$1,true)", [
            JSON.stringify(aal ? { sub: owner, aal } : {}),
          ]);
          await db.exec(`set local role ${aal ? "authenticated" : "anon"}`);
          const args = rpc[name].map((k) =>
            k === "requested_lines"
              ? JSON.stringify(body[k])
              : (body[k] ?? null),
          );
          const tabular = name === "check_bag_availability";
          const result = await db.query(
            `select ${tabular ? "* from " : ""}public.${name}(${args.map((_, i) => "$" + (i + 1)).join(",")})${tabular ? "" : " result"}`,
            args,
          );
          await db.exec("commit");
          return tabular ? result.rows : result.rows[0]?.result;
        } catch (e) {
          await db.exec("rollback");
          throw e;
        }
      });
      send(result);
      return;
    }
    if (pathname === "/storage/v1/object/list/seen-media") {
      if (aal !== "aal2") {
        send({}, 403);
        return;
      }
      send(
        [...uploads].map(([name, buffer]) => ({
          id: name,
          name,
          created_at: new Date().toISOString(),
          metadata: { size: buffer.length },
          user_metadata: { originalName: uploadNames.get(name) },
        })),
      );
      return;
    }
    if (pathname.startsWith("/storage/v1/object/upload/sign/seen-media/")) {
      if (req.method === "POST") {
        if (aal !== "aal2") {
          send({}, 403);
          return;
        }
        send({
          url: `/object/upload/sign/seen-media/${pathname.split("/").pop()}?token=test-upload`,
        });
        return;
      }
      const name = pathname.split("/").pop();
      if (req.method === "PUT") {
        uploads.set(name, raw);
        uploadNames.set(
          name,
          req.headers["x-metadata"]
            ? JSON.parse(
                Buffer.from(
                  String(req.headers["x-metadata"]),
                  "base64",
                ).toString(),
              ).originalName
            : name,
        );
        await serial(() =>
          db.query(
            "insert into storage.objects(bucket_id,name) values('seen-media',$1)",
            [name],
          ),
        );
        send({ Key: `seen-media/${name}` });
        return;
      }
    }
    if (pathname.startsWith("/storage/v1/object/sign/seen-media/")) {
      const name = pathname.split("/").pop();
      if (req.method === "POST") {
        const pub = await serial(() =>
          db.query("select public.is_published_seen_media($1) ok", [name]),
        );
        if (aal !== "aal2" && !pub.rows[0].ok) {
          send({}, 403);
          return;
        }
        send({ signedURL: `/object/sign/seen-media/${name}?token=test-read` });
        return;
      }
      const buffer = uploads.get(name);
      if (!buffer) {
        send({}, 404);
        return;
      }
      res.writeHead(200, {
        "Content-Type": name.endsWith("mp4") ? "video/mp4" : "image/webp",
        "Content-Length": buffer.length,
      });
      res.end(buffer);
      return;
    }
    send({ message: "Not found" }, 404);
  } catch (e) {
    send(
      {
        code: e.code || "TEST_ERROR",
        // PostgREST preserves custom PostgreSQL exception messages. Simulate
        // those business-rule errors so the UI can exercise actionable copy.
        message: e.code === "P0001" ? e.message : "Fixture request failed",
      },
      400,
    );
  }
});
server.listen(3106, "127.0.0.1", () =>
  process.stdout.write("Admin test provider ready on 3106\n"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => void db.close().then(() => process.exit(0))),
  );
