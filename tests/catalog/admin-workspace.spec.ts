import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import { defaultDocument } from "../../src/lib/cms/model";
import { recoveryProof, validRecoveryProof } from "../../src/lib/admin/recovery-proof";
import { customerCopy } from "../../src/lib/admin/presentation";

let db: PGlite;
const owner="10000000-0000-4000-8000-000000000010",editor="10000000-0000-4000-8000-000000000011",outsider="10000000-0000-4000-8000-000000000012",newUser="10000000-0000-4000-8000-000000000013";
async function claims(id:string|null,aal="aal1"){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(id?{sub:id,aal}:{})]);}
async function denied(fn:()=>Promise<unknown>){await db.exec("savepoint rejected");await expect(fn()).rejects.toThrow();await db.exec("rollback to savepoint rejected;release savepoint rejected");}
test.beforeAll(async()=>{
  test.setTimeout(120000);db=new PGlite();
  await db.exec(`create role anon nologin;create role authenticated nologin;create role service_role nologin;
    create schema auth;create table auth.users(id uuid primary key,email text unique,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}') $$;
    grant usage on schema auth to anon,authenticated;
    create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,delete on storage.objects to anon,authenticated;`);
  for(const file of (await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort())await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
  for(const [id,email]of[[owner,"owner@example.test"],[editor,"editor@example.test"],[outsider,"outside@example.test"],[newUser,"new@admin.invalid"]])await db.query("insert into auth.users values($1,$2,now())",[id,email]);
  await db.query("insert into seen_private.admin_members(user_id,role) values($1,'owner'),($2,'editor')",[owner,editor]);
});
test.afterAll(async()=>{await db?.close();});test.beforeEach(async()=>{await db.exec("begin");await claims(owner);});test.afterEach(async()=>{await db.exec("rollback");});

test("password-only owner access requires active approved membership and preserves editor boundaries",async()=>{
  expect((await db.query<any>("select public.admin_access() value")).rows[0].value).toMatchObject({allowed:true,password_only_ready:true,mfa:false,role:"owner"});
  await db.query("select public.admin_snapshot()");await db.query("select public.admin_account_team()");
  await claims(editor);await db.query("select public.admin_snapshot()");await denied(()=>db.query("select public.admin_account_team()"));
  await claims(outsider);await denied(()=>db.query("select public.admin_snapshot()"));
  await claims(owner);await db.query("update seen_private.admin_members set active=false where user_id=$1",[owner]);await denied(()=>db.query("select public.admin_snapshot()"));
  await claims(null);expect((await db.query<any>("select public.is_seen_admin() value")).rows[0].value).toBe(false);
});
test("anonymous and ordinary authenticated users cannot call provisioning, token or identity lookup functions",async()=>{
  for(const role of ["anon","authenticated"]){await db.exec(`set local role ${role}`);
    await denied(()=>db.query("select public.admin_account_lookup('owner@example.test')"));
    await denied(()=>db.query("select public.admin_account_claim_email($1)",["a".repeat(64)]));
    await denied(()=>db.query("select * from seen_private.admin_profiles"));await db.exec("reset role");}
});
test("owner-approved username registration resolves privately and cannot create duplicate, invalid or editor-approved accounts",async()=>{
  await denied(()=>db.query("select public.admin_account_register($1,$2,'seenabaya','SEEN','owner')",[editor,newUser]));
  await denied(()=>db.query("select public.admin_account_register($1,$2,'bad @ name','SEEN','owner')",[owner,newUser]));
  await db.query("select public.admin_account_register($1,$2,'seenabaya','SEEN','owner')",[owner,newUser]);
  const identity=(await db.query<any>("select public.admin_account_lookup('SEENABAYA') value")).rows[0].value;
  expect(identity).toEqual({userId:newUser,email:"new@admin.invalid",username:"seenabaya"});
  expect((await db.query<any>("select public.admin_account_team() value")).rows[0].value.find((v:any)=>v.id===newUser)).toMatchObject({username:"seenabaya",email:null,emailVerified:false,role:"owner"});
  await denied(()=>db.query("select public.admin_account_register($1,$2,'seenabaya','SEEN','owner')",[owner,newUser]));
});
test("email verification is bound to an approved account, expires and can be claimed only once",async()=>{
  const token="a".repeat(64);
  await denied(()=>db.query("select public.admin_account_email_request($1,'person@example.test',$2)",[outsider,token]));
  await db.query("select public.admin_account_email_request($1,'person@example.test',$2)",[owner,token]);
  await denied(()=>db.query("select public.admin_account_claim_email($1)",["b".repeat(64)]));
  expect((await db.query<any>("select public.admin_account_claim_email($1) value",[token])).rows[0].value).toEqual({userId:owner,email:"person@example.test",previousEmail:"owner@example.test"});
  await denied(()=>db.query("select public.admin_account_claim_email($1)",[token]));
  await db.query("select public.admin_account_email_request($1,'other@example.test',$2)",[owner,"c".repeat(64)]);
  await db.exec("update seen_private.admin_email_requests set expires_at=clock_timestamp()-interval '1 minute'");
  await denied(()=>db.query("select public.admin_account_claim_email($1)",["c".repeat(64)]));
});
test("outdated verification links cannot overwrite a newer confirmed email or disabled account",async()=>{
  const token="d".repeat(64);await db.query("select public.admin_account_email_request($1,'target@example.test',$2)",[owner,token]);
  await db.query("update auth.users set email='changed@example.test' where id=$1",[owner]);
  await denied(()=>db.query("select public.admin_account_claim_email($1)",[token]));
  await db.query("update auth.users set email='owner@example.test' where id=$1",[owner]);
  await db.query("update seen_private.admin_members set active=false where user_id=$1",[owner]);
  await denied(()=>db.query("select public.admin_account_claim_email($1)",[token]));
});
test("shared account limits retain only hashed identities and reject excess attempts",async()=>{
  for(let i=0;i<10;i++)await db.query("select public.admin_account_attempt($1,$2,'login')",["a".repeat(64),"b".repeat(64)]);
  await denied(()=>db.query("select public.admin_account_attempt($1,$2,'login')",["a".repeat(64),"b".repeat(64)]));
  expect((await db.query<any>("select count(*)::int value from seen_private.admin_auth_attempts")).rows[0].value).toBe(10);
  expect(JSON.stringify((await db.query("select * from seen_private.admin_auth_attempts")).rows)).not.toContain("@example.test");
});
test("rerunning account setup preserves approved users and published commerce data without creating a default account",async()=>{
  await db.query("update seen_private.site_documents set draft=$1,published=$1 where id",[defaultDocument]);
  const before=(await db.query<any>("select count(*)::int value from auth.users")).rows[0].value;
  const script=(await readFile("supabase/migrations/20261023000200_admin_workspace.sql","utf8")).replace(/^begin;\s*$/m,"").replace(/^commit;\s*$/m,"");await db.exec(script);
  expect((await db.query<any>("select count(*)::int value from auth.users")).rows[0].value).toBe(before);
  expect((await db.query<any>("select published from seen_private.site_documents where id")).rows[0].published).toEqual(defaultDocument);
  expect((await db.query<any>("select public.admin_account_lookup('seenabaya') value")).rows[0].value).toBeNull();
});
test("password reset proof is session-bound, expires and rejects normal sessions or edited tokens",()=>{
  const secret="PRIVATE_TEST_SECRET_ONLY_123456789",now=Date.now();const token=recoveryProof(owner,"session-one",secret,now);
  expect(validRecoveryProof(token,owner,"session-one",secret,now)).toBe(true);
  expect(validRecoveryProof(token,owner,"session-two",secret,now)).toBe(false);
  expect(validRecoveryProof(token,newUser,"session-one",secret,now)).toBe(false);
  expect(validRecoveryProof(token,owner,"session-one",secret,now+600001)).toBe(false);
  expect(validRecoveryProof(token+"x",owner,"session-one",secret,now)).toBe(false);
  expect(validRecoveryProof(undefined,owner,"session-one",secret,now)).toBe(false);
});
test("website text uses customer page names and excludes internal endpoints, tokens and diagnostics",()=>{
  const copy=customerCopy([{text:"Made to",groups:["home · film-hero"]},{text:"Something",groups:["api · checkout · route"]},{text:"STRIPE_SECRET_KEY",groups:["src · lib · payments · model"]},{text:"cross-site",groups:["src · lib · payments · http"]}]);
  expect(copy).toHaveLength(1);expect(copy[0].places).toEqual([{name:"Homepage",path:"/"}]);
});
