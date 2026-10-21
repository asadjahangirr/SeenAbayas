import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";

// Actual setup/configuration/check SQL and real pgcrypto HMAC, with local
// contracts standing in for Supabase Vault, pg_cron and pg_net. No HTTP is sent.
let db: PGlite;
let setup: string, check: string;
const token = "isolated-stock-setup-token-12345678901234567890";
const endpoint = "https://seenabayas.vercel.app/api/payments/reconcile";
test.beforeEach(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  const original = await readFile("supabase/setup-stock-recovery.sql", "utf8");
  // These two platform-owned extensions are unavailable inside PGlite. The
  // production check is retained/tested separately; only this fixture skips it.
  setup = original.replace(/-- BEGIN platform prerequisite checks[\s\S]*?-- END platform prerequisite checks\./, "");
  check = await readFile("supabase/check-stock-recovery.sql", "utf8");
  await db.exec(`
    create role anon;create role authenticated;create role service_role;
    create schema seen_private;create schema vault;create schema cron;create schema net;create schema extensions;
    create extension pgcrypto with schema extensions;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    create table cron.job(jobid bigserial primary key,jobname text unique,schedule text,command text,active boolean default true);
    create function cron.schedule(name text,expression text,sql text) returns bigint language sql as $$
      insert into cron.job(jobname,schedule,command) values(name,expression,sql)
      on conflict(jobname) do update set schedule=excluded.schedule,command=excluded.command,active=true returning jobid;
    $$;
    create table net.queued(id bigserial primary key,url text,headers jsonb,body jsonb,timeout_milliseconds integer);
    create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$
      insert into net.queued(url,headers,body,timeout_milliseconds) values(url,headers,body,timeout_milliseconds) returning id;
    $$;
    create table net._http_response(id bigint,status_code integer,timed_out boolean,content text);
    create table seen_private.inventory(on_hand integer,reserved integer);
    insert into seen_private.inventory values(4,2);
    create table seen_private.checkout_orders(state text);
    insert into seen_private.checkout_orders values('pending');
  `);
  await db.query("insert into vault.decrypted_secrets values('seen_stock_recovery_token',$1),('seen_stock_recovery_url',$2)", [token, endpoint]);
});
test.afterEach(async () => { await db?.close(); });
async function readCheck() {
  return (await db.exec(check)).at(-1)!;
}

test("setup creates private objects and one every-minute job; reruns preserve requests and commerce data", async () => {
  await db.exec(setup);
  expect((await db.query("select jobname,schedule,active from cron.job")).rows).toEqual([{jobname:"seen-stock-recovery",schedule:"* * * * *",active:true}]);
  await db.query("select seen_private.enqueue_stock_recovery()");
  await db.exec(setup);
  expect((await db.query("select * from cron.job")).rows).toHaveLength(1);
  expect((await db.query("select * from seen_private.stock_recovery_requests")).rows).toHaveLength(1);
  expect((await db.query("select * from seen_private.inventory")).rows).toEqual([{on_hand:4,reserved:2}]);
  expect((await db.query("select * from seen_private.checkout_orders")).rows).toEqual([{state:"pending"}]);
  for(const role of ["anon","authenticated","service_role"]){
    const r=await db.query<{config:boolean;enqueue:boolean;records:boolean}>("select has_function_privilege($1,'seen_private.stock_recovery_configuration()','execute') config,has_function_privilege($1,'seen_private.enqueue_stock_recovery()','execute') enqueue,has_table_privilege($1,'seen_private.stock_recovery_requests','select') records",[role]);
    expect(r.rows[0]).toEqual({config:false,enqueue:false,records:false});
  }
});

test("URL clipboard whitespace and trailing slash normalise identically at install and run; token bytes remain exact", async () => {
  const exactToken=` ${token} `;
  await db.query("update vault.decrypted_secrets set decrypted_secret=$1 where name='seen_stock_recovery_url'",[` \t${endpoint}/\r\n`]);
  await db.query("update vault.decrypted_secrets set decrypted_secret=$1 where name='seen_stock_recovery_token'",[exactToken]);
  await db.exec(setup);
  await db.query("select seen_private.enqueue_stock_recovery()");
  const q=(await db.query<any>("select * from net.queued")).rows[0];
  expect(q.url).toBe(endpoint);
  const stamp=q.headers["x-seen-recovery-timestamp"];
  expect(q.headers["x-seen-recovery-signature"]).toBe(createHmac("sha256",exactToken).update(`seen-stock-recovery:v1:${stamp}:POST:/api/payments/reconcile`).digest("hex"));
  expect(JSON.stringify(q)).not.toContain(exactToken);
  expect(q.headers.Authorization).toBeUndefined();
});

test("configured presence is insufficient: short/empty/null/oversized tokens fail precisely and roll back setup", async () => {
  for(const value of [null,"","CONFIGURED","x".repeat(257)]) {
    await db.query("update vault.decrypted_secrets set decrypted_secret=$1 where name='seen_stock_recovery_token'",[value]);
    await expect(db.exec(setup)).rejects.toThrow("actual 32-256 character recovery token");
    await db.exec("rollback");
    expect((await db.query("select * from cron.job")).rows).toHaveLength(0);
    expect((await db.query<any>("select to_regclass('seen_private.stock_recovery_requests') name")).rows[0].name).toBeNull();
  }
});

test("missing or duplicated exact Vault names fail without leaking values", async () => {
  await db.query("delete from vault.decrypted_secrets where name='seen_stock_recovery_token'");
  await expect(db.exec(setup)).rejects.toThrow("seen_stock_recovery_token is missing or duplicated");await db.exec("rollback");
  await db.query("insert into vault.decrypted_secrets values('seen_stock_recovery_token',$1)",[token]);
  await db.query("insert into vault.decrypted_secrets values('seen_stock_recovery_url',$1)",[endpoint]);
  await expect(db.exec(setup)).rejects.toThrow("seen_stock_recovery_url is missing or duplicated");await db.exec("rollback");
});

test("URL security rejects insecure origins, credentials, wrong paths, Markdown, queries and fragments", async () => {
  for(const value of ["http://seenabayas.vercel.app/api/payments/reconcile","https://user:pass@seenabayas.vercel.app/api/payments/reconcile","https://seenabayas.vercel.app/wrong",`${endpoint}?token=unsafe`,`${endpoint}#fragment`,`[${endpoint}](${endpoint})`,null]) {
    await db.query("update vault.decrypted_secrets set decrypted_secret=$1 where name='seen_stock_recovery_url'",[value]);
    await expect(db.exec(setup)).rejects.toThrow("seen_stock_recovery_url is not a valid recovery endpoint");await db.exec("rollback");
    expect((await db.query("select * from cron.job")).rows).toHaveLength(0);
  }
});

test("verification explains absent setup rather than 42P01 and shows waiting/HTTP outcomes after installation", async () => {
  await expect(db.exec(check)).rejects.toThrow("Stock recovery setup is incomplete");
  await db.exec(setup);
  let result=await readCheck();
  expect(result.rows[0].diagnostic).toBe("WAITING_FOR_FIRST_REQUEST_CHECK_CRON_HISTORY");
  await db.query("select seen_private.enqueue_stock_recovery()");
  await db.query("insert into net._http_response values(1,200,false,$1)",[JSON.stringify({checked:0,updated:0,retryRequired:0})]);
  result=await readCheck();
  expect(result.rows[0]).toMatchObject({status_code:200,timed_out:false,diagnostic:"CHECK_RECOVERY_RESULT"});
  await db.exec("update cron.job set active=false");
  expect((await readCheck()).rows[0]).toMatchObject({diagnostic:"JOB_INACTIVE"});
});

test("runtime still validates Vault after rotation and never queues invalid configuration", async () => {
  await db.exec(setup);
  await db.query("update vault.decrypted_secrets set decrypted_secret='CONFIGURED' where name='seen_stock_recovery_token'");
  await expect(db.query("select seen_private.enqueue_stock_recovery()")).rejects.toThrow("actual 32-256 character recovery token");
  expect((await db.query("select * from net.queued")).rows).toHaveLength(0);
});

test("production setup retains platform prerequisites instead of silently skipping extension security checks", async () => {
  const original=await readFile("supabase/setup-stock-recovery.sql","utf8");
  await expect(db.exec(original)).rejects.toThrow("Enable pg_cron, pg_net and pgcrypto");await db.exec("rollback");
  expect((await db.query("select * from cron.job")).rows).toHaveLength(0);
});
