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
  await db.query("insert into seen_private.admin_primary_account(user_id) values($1)",[owner]);
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
  await denied(()=>db.query("select public.admin_account_register_permissions($1,$2,'seenabaya','SEEN',array['products'])",[editor,newUser]));
  await denied(()=>db.query("select public.admin_account_register_permissions($1,$2,'bad @ name','SEEN',array['products'])",[owner,newUser]));
  await db.query("select public.admin_account_register_permissions($1,$2,'seenabaya','SEEN',array['products'])",[owner,newUser]);
  const identity=(await db.query<any>("select public.admin_account_lookup('SEENABAYA') value")).rows[0].value;
  expect(identity).toEqual({userId:newUser,email:"new@admin.invalid",username:"seenabaya"});
  expect((await db.query<any>("select public.admin_account_team() value")).rows[0].value.find((v:any)=>v.id===newUser)).toMatchObject({username:"seenabaya",email:null,emailVerified:false,role:"owner"});
  await denied(()=>db.query("select public.admin_account_register_permissions($1,$2,'seenabaya','SEEN',array['products'])",[owner,newUser]));
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

test("main administrator alone assigns access, with version checks and protected main account",async()=>{
  await db.query("select public.admin_account_register_permissions($1,$2,'assistant','Assistant',array['settings.announcement'])",[owner,newUser]);
  await claims(newUser);
  expect((await db.query<any>("select public.admin_access() value")).rows[0].value).toMatchObject({main_admin:false,permissions:['settings.announcement']});
  await denied(()=>db.query("select public.admin_account_team()"));
  await denied(()=>db.query("select public.admin_account_set_permissions($1,array['finance'],true,1)",[newUser]));
  await claims(owner);
  await denied(()=>db.query("select public.admin_account_set_permissions($1,array[]::text[],false,0)",[owner]));
  await denied(()=>db.query("select public.admin_account_set_permissions($1,array['invented'],true,1)",[newUser]));
  await db.query("select public.admin_account_set_permissions($1,array['content'],true,1)",[newUser]);
  await denied(()=>db.query("select public.admin_account_set_permissions($1,array['finance'],true,1)",[newUser]));
  await db.query("select public.admin_account_set_permissions($1,array['content'],false,2)",[newUser]);
  await claims(newUser);await denied(()=>db.query("select public.admin_snapshot()"));
});

test("assigned announcement works while other settings, publication and direct legacy RPCs are denied",async()=>{
  await db.query("select public.admin_save_site($1,0,true)",[defaultDocument]);
  await db.query("select public.admin_account_register_permissions($1,$2,'bannereditor','Banner editor',array['settings.announcement'])",[owner,newUser]);
  await claims(newUser);await db.exec('set local role authenticated');
  const edited=structuredClone(defaultDocument);edited.announcement.text='An approved announcement';
  await db.query("select public.admin_save_site($1,1,false)",[edited]);
  const tampered=structuredClone(edited);tampered.commerce.freeDeliveryThresholdPence=1;
  await denied(()=>db.query("select public.admin_save_site($1,2,false)",[tampered]));
  await denied(()=>db.query("select public.admin_save_site($1,2,true)",[edited]));
  await denied(()=>db.query("select seen_private.permission_base_admin_save_site($1,2,true)",[tampered]));
  await denied(()=>db.query("select public.admin_save_record('coupon',null,$1,0)",[{code:'BAD',type:'percent',value:10}]));
  await denied(()=>db.query("select public.admin_bulk_products(array[gen_random_uuid()],'archive',null)"));
  await db.exec('reset role');await claims(owner);
  await db.query("select public.admin_account_set_permissions($1,array['settings.announcement','publish'],true,1)",[newUser]);
  await claims(newUser);await db.query("select public.admin_save_site($1,2,true)",[edited]);
});

test("publishing cannot include another administrator's unassigned pending settings",async()=>{
  await db.query("select public.admin_save_site($1,0,true)",[defaultDocument]);
  const draft=structuredClone(defaultDocument);draft.commerce.minimumOrderPence=100;
  await db.query("select public.admin_save_site($1,1,false)",[draft]);
  await db.query("select public.admin_account_register_permissions($1,$2,'bannerpublisher','Banner publisher',array['settings.announcement','publish'])",[owner,newUser]);
  await claims(newUser);draft.announcement.text='Our latest news';
  await denied(()=>db.query("select public.admin_save_site($1,2,true)",[draft]));
  await db.query("select public.admin_save_site($1,2,false)",[draft]);
});

test("snapshots exclude customer, finance and activity data outside the assigned sections",async()=>{
  await db.exec("insert into seen_private.admin_records(kind,payload) values('message','{\"name\":\"Private customer\"}'),('expense','{\"amount_pence\":100}'),('category','{\"name\":\"Collection\"}')");
  await db.query("select public.admin_account_register_permissions($1,$2,'inboxhelper','Inbox helper',array['inbox'])",[owner,newUser]);
  await claims(newUser);const result=(await db.query<any>("select public.admin_snapshot() value")).rows[0].value;
  expect(result.records.map((r:any)=>r.kind)).toEqual(['message']);expect(result.products).toEqual([]);expect(result.statistics).toBeNull();expect(result.audit).toEqual([]);expect(result.history).toEqual([]);
});

test("revoked permissions apply to an existing session and main identity survives an email change",async()=>{
  await db.query("select public.admin_account_register_permissions($1,$2,'discounthelper','Discount helper',array['coupons'])",[owner,newUser]);
  const coupon={code:'HELPER',type:'free_delivery',value:0,active:true};
  await claims(newUser);await db.query("select public.admin_save_record('coupon',null,$1,0)",[coupon]);
  await claims(owner);await db.query("select public.admin_account_set_permissions($1,array[]::text[],true,1)",[newUser]);
  await claims(newUser);await denied(()=>db.query("select public.admin_save_record('coupon',null,$1,0)",[{...coupon,code:'BLOCKED'}]));
  await claims(owner);await db.query("update auth.users set email='new-main@example.test' where id=$1",[owner]);
  expect((await db.query<any>("select public.admin_access() value")).rows[0].value.main_admin).toBe(true);
});

test("direct private storage uploads require explicit media permission",async()=>{
  await db.query("select public.admin_account_register_permissions($1,$2,'producthelper','Product helper',array['products'])",[owner,newUser]);
  await claims(newUser);await db.exec('set local role authenticated');
  await denied(()=>db.query("insert into storage.objects(bucket_id,name) values('seen-media','11111111-1111-4111-8111-111111111111.jpg')"));
  await db.exec('reset role');await claims(owner);await db.query("select public.admin_account_set_permissions($1,array['products','media'],true,1)",[newUser]);
  await claims(newUser);await db.exec('set local role authenticated');
  await db.query("insert into storage.objects(bucket_id,name) values('seen-media','11111111-1111-4111-8111-111111111111.jpg')");
  await db.exec('reset role');
});

test("permissions migration reruns without resetting assignments or commerce",async()=>{
  await db.query("select public.admin_account_register_permissions($1,$2,'retainedhelper','Retained helper',array['inbox'])",[owner,newUser]);
  const script=(await readFile('supabase/migrations/20261023000500_admin_permissions.sql','utf8')).replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'');await db.exec(script);
  await claims(newUser);expect((await db.query<any>("select public.admin_access() value")).rows[0].value.permissions).toEqual(['inbox']);await denied(()=>db.query("select public.admin_account_team()"));
});

test("limited publishing works before the first owner save, using the same document defaults",async()=>{
  await db.query("select public.admin_account_register_permissions($1,$2,'firstbanner','First banner',array['settings.announcement','publish'])",[owner,newUser]);
  await claims(newUser);const document=structuredClone(defaultDocument);document.announcement.text='First banner update';
  await db.query("select public.admin_save_site($1,0,true)",[document]);
  expect((await db.query<any>("select published from seen_private.site_documents where id")).rows[0].published.announcement.text).toBe('First banner update');
});

test("product editors can save stock and see category choices without managing categories or deleting products",async()=>{
  await db.exec("insert into seen_private.admin_records(kind,payload) values('category','{\"name\":\"Abayas\",\"slug\":\"abayas\"}')");
  await db.query("select public.admin_account_register_permissions($1,$2,'pieceshelper','Pieces helper',array['products'])",[owner,newUser]);
  await claims(newUser);const p={design_reference:'design-99',name:'Test only',description:'An isolated fixture product',price_pence:4000,cost_pence:2000,status:'draft',details_confirmed:false,sort_order:99,photos:[],category:'abayas',tone:'Olive',variants:[{size_label:'54',sku:'TEST-99',active:true,on_hand:3}]};
  const id=(await db.query<any>("select public.admin_save_product($1,null) id",[p])).rows[0].id;
  const snapshot=(await db.query<any>("select public.admin_snapshot() value")).rows[0].value;
  expect(snapshot.products.find((product:any)=>product.id===id).variants[0].on_hand).toBe(3);expect(snapshot.records.some((r:any)=>r.kind==='category')).toBe(true);
  await denied(()=>db.query("select public.admin_save_record('category',null,$1,0)",[{name:'Disallowed',slug:'disallowed'}]));
  await denied(()=>db.query("select public.admin_delete_product($1,now())",[id]));
});
