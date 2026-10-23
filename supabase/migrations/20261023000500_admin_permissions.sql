-- Apply after checkout_coupons. Rerunnable; preserves orders, stock and accounts.
-- Existing staff retain their former section access until the main admin edits it.
begin;
create table if not exists seen_private.admin_primary_account (
  id boolean primary key default true check(id), user_id uuid not null unique references auth.users(id)
);
insert into seen_private.admin_primary_account(id,user_id)
select true,u.id from auth.users u join seen_private.admin_members m on m.user_id=u.id
where lower(u.email)='asadjahangirr9@gmail.com' and u.email_confirmed_at is not null and m.active and m.role='owner'
on conflict(id) do nothing;
create table if not exists seen_private.admin_permissions (
  user_id uuid primary key references seen_private.admin_members(user_id) on delete cascade,
  permissions text[] not null default '{}', version integer not null default 1
);
alter table seen_private.admin_primary_account enable row level security;
alter table seen_private.admin_permissions enable row level security;
revoke all on seen_private.admin_primary_account,seen_private.admin_permissions from public,anon,authenticated,service_role;

create or replace function seen_private.permission_keys() returns text[] language sql immutable set search_path='' as $$
 select array['products','products.delete','categories','orders','inbox','finance','coupons','content','hero','media',
 'appearance.colours','appearance.motion','appearance.featured','settings.announcement','settings.delivery',
 'settings.business','settings.privacy','settings.review','publish','history']::text[];
$$;
create or replace function seen_private.is_primary_admin(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from seen_private.admin_primary_account p join seen_private.admin_members m on m.user_id=p.user_id
 where p.user_id=target and m.active and m.role='owner');
$$;
create or replace function seen_private.member_permissions(target uuid) returns text[] language sql stable security definer set search_path='' as $$
 select coalesce((select p.permissions from seen_private.admin_permissions p where p.user_id=target),
   (select case when m.role='owner' then seen_private.permission_keys() else array['products','categories','content','hero','media','appearance.colours','appearance.motion','appearance.featured','publish','history']::text[] end
    from seen_private.admin_members m where m.user_id=target and m.active),'{}'::text[]);
$$;
create or replace function public.admin_can(capability text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_seen_admin() and (seen_private.is_primary_admin(auth.uid()) or capability=any(seen_private.member_permissions(auth.uid())));
$$;
create or replace function seen_private.require_permission(capability text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_can(capability) then raise exception 'This action is not assigned to your account' using errcode='42501'; end if;
end $$;
create or replace function public.admin_access() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select jsonb_build_object('role',m.role,'allowed',m.active,'mfa',coalesce(auth.jwt()->>'aal','')='aal2',
 'password_only_ready',true,'permissions_ready',true,'main_admin',seen_private.is_primary_admin(m.user_id),
 'permissions',case when m.active then seen_private.member_permissions(m.user_id) else '{}'::text[] end)
 from seen_private.admin_members m where m.user_id=auth.uid()),'{"allowed":false,"password_only_ready":true,"permissions_ready":true,"main_admin":false,"permissions":[]}');
$$;

-- Move the existing implementations out of the exposed schema, retaining all
-- existing validation, row locks, version checks and payment/stock safeguards.
do $$ declare spec text; name text; signature text; begin
 foreach spec in array array[
 'admin_snapshot()', 'admin_save_site(jsonb,integer,boolean)', 'admin_restore_site(integer,integer)',
 'admin_save_product(jsonb,timestamptz)', 'admin_bulk_products(uuid[],text,integer)',
 'admin_delete_product(uuid,timestamptz)', 'admin_save_record(text,uuid,jsonb,integer)',
 'admin_delete_record(uuid,integer)', 'admin_account_register(uuid,uuid,text,text,text)', 'admin_account_team()'
 ] loop
  name:=split_part(spec,'(',1); signature:=substring(spec from position('(' in spec));
  if to_regprocedure('seen_private.permission_base_'||spec) is null then
   execute 'alter function public.'||spec||' rename to permission_base_'||name;
   execute 'alter function public.permission_base_'||name||signature||' set schema seen_private';
  end if;
  execute 'revoke all on function seen_private.permission_base_'||spec||' from public,anon,authenticated,service_role';
 end loop;
end $$;

create or replace function public.admin_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; begin
 perform seen_private.require_admin();
 result:=seen_private.permission_base_admin_snapshot();
 result:=jsonb_set(result,'{records}',coalesce((select jsonb_agg(r) from jsonb_array_elements(result->'records') r
 where (r->>'kind'='category' and public.admin_can('products')) or public.admin_can(case r->>'kind' when 'category' then 'categories' when 'order' then 'orders' when 'expense' then 'finance' when 'message' then 'inbox' when 'coupon' then 'coupons' else 'unassigned' end)),'[]'));
 if not public.admin_can('finance') then result:=jsonb_set(result,'{statistics}','null'); end if;
 if not public.admin_can('history') then result:=jsonb_set(jsonb_set(result,'{audit}','[]'),'{history}','[]'); end if;
 if not public.admin_can('products') then
  if public.admin_can('appearance.featured') or public.admin_can('settings.delivery') then
   result:=jsonb_set(result,'{products}',coalesce((select jsonb_agg(p||jsonb_build_object('cost_pence',null,'variants',case when public.admin_can('settings.delivery') then
     coalesce((select jsonb_agg(v||jsonb_build_object('on_hand',0,'reserved',0,'sku','')) from jsonb_array_elements(p->'variants') v),'[]') else '[]'::jsonb end)) from jsonb_array_elements(result->'products') p),'[]'));
  else result:=jsonb_set(result,'{products}','[]'); end if;
 end if;
 return result||jsonb_build_object('access',public.admin_access());
end $$;

-- Keep comparisons consistent with the storefront's defaulted document parser.
create or replace function seen_private.normalise_admin_document(document jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare defaults jsonb:='{"text":{},"media":{},"sections":[],"hero":{"videos":["/videos/home/hero.mp4"],"poster":"/images/home/hero-poster.webp","ctaLink":"/collection"},"appearance":{"ink":"#171717","paper":"#ffffff","accent":"#8b6a49","motion":"editorial","hover":"sheen"},"announcement":{"enabled":true,"text":"Complimentary UK delivery on orders of {threshold} or more","link":"/shipping-delivery","background":"#171717","ink":"#ffffff","duration":48},"commerce":{"freeDeliveryEnabled":true,"freeDeliveryThresholdPence":8000,"minimumOrderPence":0},"featured":["design-01","design-02","design-03","design-06"],"policies":{"review":{"status":"draft","reviewedOn":null},"business":{"legalName":null,"legalForm":null,"businessAddress":null,"returnsAddress":null,"registrationNumber":null,"vatRegistered":null,"vatNumber":null,"phone":null},"delivery":{"dispatchWindow":null,"standardChargePence":null,"standardDeliveryAim":null,"expressAvailable":null,"expressChargePence":null,"expressDeliveryAim":null,"destinations":null,"internationalAvailability":null},"privacy":{"enquiryLawfulBasis":null,"securityLawfulBasis":null,"enquiryRetention":null,"hostingAndLogs":null,"providersAndTransfers":null}},"shipping":{"mode":"fixed","accountType":"unknown","dispatchPostcode":"","packagingWeightGrams":null,"lengthMm":null,"widthMm":null,"heightMm":null,"packageFormat":"SmallParcel","maxItemsPerParcel":null,"standardServiceCode":"","expressServiceCode":"","priceBasis":"unconfirmed","variantWeights":{}}}'::jsonb; result jsonb; begin
 if document is null or jsonb_typeof(document)<>'object' or not(document ?& array['text','media','hero','appearance','announcement','policies','featured','commerce']) then return defaults; end if;
 result:=defaults||document;
 result:=jsonb_set(result,'{shipping}',defaults->'shipping'||coalesce(document->'shipping','{}'::jsonb));
 result:=jsonb_set(result,'{announcement}',defaults->'announcement'||coalesce(document->'announcement','{}'::jsonb));
 result:=jsonb_set(result,'{hero}',defaults->'hero'||coalesce(document->'hero','{}'::jsonb));
 return result;
end $$;

-- Check changes against BOTH draft and publication. A limited administrator
-- cannot publish somebody else's pending changes to an unassigned setting.
create or replace function seen_private.check_document_permissions(previous jsonb,document jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare path text[]; mapping record; begin
 if seen_private.is_primary_admin(auth.uid()) then return; end if;
 previous:=seen_private.normalise_admin_document(previous);
 for mapping in select * from (values
 ('text','content'),('media','media'),('sections','media'),('hero','hero'),
 ('appearance.ink','appearance.colours'),('appearance.paper','appearance.colours'),('appearance.accent','appearance.colours'),
 ('appearance.motion','appearance.motion'),('appearance.hover','appearance.motion'),('featured','appearance.featured'),
 ('announcement','settings.announcement'),('commerce','settings.delivery'),('shipping','settings.delivery'),
 ('policies.delivery','settings.delivery'),('policies.business','settings.business'),('policies.privacy','settings.privacy'),('policies.review','settings.review')
 ) as rules(field,capability) loop
  path:=string_to_array(mapping.field,'.');
  if previous#>path is distinct from document#>path then perform seen_private.require_permission(mapping.capability); end if;
 end loop;
 if previous#>'{text,info@seenabayas.co.uk}' is distinct from document#>'{text,info@seenabayas.co.uk}' then
  perform seen_private.require_permission('settings.business');
 end if;
end $$;
create or replace function public.admin_save_site(document jsonb,expected_version integer,publish boolean default false) returns integer
language plpgsql security definer set search_path='' as $$
declare current_row seen_private.site_documents; begin
 perform seen_private.require_admin();
 select * into current_row from seen_private.site_documents where id for update;
 perform seen_private.check_document_permissions(current_row.draft,document);
 if publish then
  perform seen_private.require_permission('publish');
  perform seen_private.check_document_permissions(coalesce(current_row.published,current_row.draft),document);
 end if;
 return seen_private.permission_base_admin_save_site(document,expected_version,publish);
end $$;
create or replace function public.admin_restore_site(target_version integer,expected_version integer) returns integer
language plpgsql security definer set search_path='' as $$ begin
 perform seen_private.require_permission('history');
 return seen_private.permission_base_admin_restore_site(target_version,expected_version);
end $$;
create or replace function public.admin_save_product(product jsonb,expected_updated_at timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 perform seen_private.require_permission('products');
 return seen_private.permission_base_admin_save_product(product,expected_updated_at);
end $$;
create or replace function public.admin_bulk_products(ids uuid[],operation text,quantity integer default null) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform seen_private.require_permission('products');
 perform seen_private.permission_base_admin_bulk_products(ids,operation,quantity);
end $$;
create or replace function public.admin_delete_product(product_id uuid,expected_updated_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$ begin
 perform seen_private.require_permission('products'); perform seen_private.require_permission('products.delete');
 perform seen_private.permission_base_admin_delete_product(product_id,expected_updated_at);
end $$;
create or replace function public.admin_save_record(record_kind text,record_id uuid,data jsonb,expected_version integer default 0) returns uuid
language plpgsql security definer set search_path='' as $$ begin
 perform seen_private.require_permission(case record_kind when 'category' then 'categories' when 'order' then 'orders' when 'message' then 'inbox' when 'expense' then 'finance' when 'coupon' then 'coupons' else 'unassigned' end);
 return seen_private.permission_base_admin_save_record(record_kind,record_id,data,expected_version);
end $$;
create or replace function public.admin_delete_record(record_id uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$ declare kind text; begin
 select r.kind into kind from seen_private.admin_records r where r.id=record_id;
 perform seen_private.require_permission(case kind when 'category' then 'categories' when 'message' then 'inbox' when 'expense' then 'finance' when 'coupon' then 'coupons' else 'unassigned' end);
 perform seen_private.permission_base_admin_delete_record(record_id,expected_version);
end $$;

-- Legacy provisioning is closed; only the main account can provision, with
-- permissions inserted in the same transaction as the membership.
create or replace function public.admin_account_register(operator_id uuid,user_id uuid,username text,display_name text,member_role text) returns void
language plpgsql security definer set search_path='' as $$ begin
 raise exception 'Use main-admin permission provisioning' using errcode='42501';
end $$;
create or replace function public.admin_account_register_permissions(operator_id uuid,user_id uuid,username text,display_name text,permissions text[]) returns void
language plpgsql security definer set search_path='' as $$ begin
 if not seen_private.is_primary_admin(operator_id) or permissions is null or array_position(permissions,null) is not null or not permissions <@ seen_private.permission_keys() then raise exception 'Main administrator access required' using errcode='42501'; end if;
 -- Internal role enables existing owner-only business validation. All exposed
 -- operations are independently gated above; this is not an unrestricted owner.
 if username is null or username !~ '^[a-z][a-z0-9._-]{2,39}$' or display_name is null or length(display_name) not between 1 and 80
   or exists(select 1 from seen_private.admin_members m where m.user_id=admin_account_register_permissions.user_id) then raise exception 'Invalid new administrator'; end if;
 insert into seen_private.admin_members(user_id,role) values(user_id,'owner');
 insert into seen_private.admin_profiles(user_id,username,display_name) values(user_id,username,display_name);
 insert into seen_private.admin_permissions(user_id,permissions) values(user_id,permissions);
 insert into seen_private.admin_audit(actor,action,entity,entity_id) values(operator_id,'add administrator','account',user_id::text);
end $$;
create or replace function public.admin_account_set_permissions(target uuid,permissions text[],enabled boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare current_version integer; begin
 if not seen_private.is_primary_admin(auth.uid()) then raise exception 'Main administrator access required' using errcode='42501'; end if;
 if exists(select 1 from seen_private.admin_primary_account where user_id=target) then raise exception 'The main account cannot be restricted or disabled'; end if;
 if permissions is null or array_position(permissions,null) is not null or enabled is null or not permissions <@ seen_private.permission_keys() then raise exception 'Invalid permissions'; end if;
 perform 1 from seen_private.admin_members where user_id=target for update;
 if not found then raise exception 'Administrator not found'; end if;
 select version into current_version from seen_private.admin_permissions where user_id=target;
 if coalesce(current_version,0) is distinct from expected_version then raise exception 'Access changed. Reload before saving.' using errcode='40001'; end if;
 insert into seen_private.admin_permissions(user_id,permissions) values(target,permissions)
 on conflict(user_id) do update set permissions=excluded.permissions,version=seen_private.admin_permissions.version+1;
 update seen_private.admin_members set active=enabled,role='owner' where user_id=target;
 perform seen_private.audit('change administrator access','account',target::text);
end $$;
create or replace function public.admin_account_team() returns jsonb language plpgsql security definer set search_path='' as $$
declare team jsonb; begin
 if not seen_private.is_primary_admin(auth.uid()) then raise exception 'Main administrator access required' using errcode='42501'; end if;
 team:=seen_private.permission_base_admin_account_team();
 return coalesce((select jsonb_agg(member||jsonb_build_object('mainAdmin',exists(select 1 from seen_private.admin_primary_account p where p.user_id=(member->>'id')::uuid),
 'permissions',seen_private.member_permissions((member->>'id')::uuid),'version',coalesce((select version from seen_private.admin_permissions where user_id=(member->>'id')::uuid),0)))
 from jsonb_array_elements(team) member),'[]');
end $$;

-- Direct storage calls also follow permissions, independently of the Next API.
drop policy if exists "Administrators upload media" on storage.objects;
create policy "Administrators upload media" on storage.objects for insert to authenticated
with check(bucket_id='seen-media' and public.admin_can('media') and name ~ '^[a-f0-9-]+\.(webp|jpg|png|mp4)$');
drop policy if exists "Published or administrator media reads" on storage.objects;
create policy "Published or administrator media reads" on storage.objects for select to anon,authenticated
using(bucket_id='seen-media' and (public.admin_can('media') or public.admin_can('products') or public.admin_can('hero') or public.admin_can('content') or public.is_published_seen_media(name)));
drop policy if exists "Administrators remove unused media" on storage.objects;
create policy "Administrators remove unused media" on storage.objects for delete to authenticated
using(bucket_id='seen-media' and public.admin_can('media') and not public.is_retained_seen_media(name));

revoke all on function seen_private.normalise_admin_document(jsonb),seen_private.permission_keys(),seen_private.is_primary_admin(uuid),seen_private.member_permissions(uuid),seen_private.require_permission(text),seen_private.check_document_permissions(jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.admin_can(text) from public;
grant execute on function public.admin_can(text) to anon,authenticated;
revoke all on function public.admin_account_register(uuid,uuid,text,text,text),public.admin_account_register_permissions(uuid,uuid,text,text,text[]) from public,anon,authenticated,service_role;
grant execute on function public.admin_account_register_permissions(uuid,uuid,text,text,text[]) to service_role;
revoke all on function public.admin_snapshot(),public.admin_save_site(jsonb,integer,boolean),public.admin_restore_site(integer,integer),public.admin_save_product(jsonb,timestamptz),public.admin_bulk_products(uuid[],text,integer),public.admin_delete_product(uuid,timestamptz),public.admin_save_record(text,uuid,jsonb,integer),public.admin_delete_record(uuid,integer),public.admin_account_team(),public.admin_account_set_permissions(uuid,text[],boolean,integer) from public,anon,service_role;
grant execute on function public.admin_snapshot(),public.admin_save_site(jsonb,integer,boolean),public.admin_restore_site(integer,integer),public.admin_save_product(jsonb,timestamptz),public.admin_bulk_products(uuid[],text,integer),public.admin_delete_product(uuid,timestamptz),public.admin_save_record(text,uuid,jsonb,integer),public.admin_delete_record(uuid,integer),public.admin_account_team(),public.admin_account_set_permissions(uuid,text[],boolean,integer) to authenticated;
commit;

select exists(select 1 from seen_private.admin_primary_account) as main_admin_ready, 'Administrator permissions installed' as status;
