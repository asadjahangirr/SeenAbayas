-- Invite-only administration. Apply after catalog and bag migrations.
begin;
create table seen_private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table seen_private.admin_members enable row level security;

create function public.admin_access() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('role',role,'allowed',active,'mfa',coalesce(auth.jwt()->>'aal','') = 'aal2') from seen_private.admin_members where user_id=auth.uid()),'{"allowed":false,"mfa":false}'::jsonb);
$$;
revoke all on function public.admin_access() from public,anon;
grant execute on function public.admin_access() to authenticated;

create function public.is_seen_admin(owner_only boolean default false) returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt()->>'aal','') = 'aal2' and exists(select 1 from seen_private.admin_members where user_id=auth.uid() and active and (not owner_only or role='owner'));
$$;
revoke all on function public.is_seen_admin(boolean) from public;
grant execute on function public.is_seen_admin(boolean) to anon,authenticated;
create function seen_private.require_admin(owner_only boolean default false) returns void language plpgsql security definer set search_path = '' as $$
begin if not public.is_seen_admin(owner_only) then raise exception 'Administration access denied' using errcode='42501'; end if; end $$;

create table seen_private.site_documents (
  id boolean primary key default true check(id), version integer not null default 0,
  draft jsonb not null default '{}'::jsonb, published jsonb,
  updated_at timestamptz not null default now(), published_at timestamptz
);
insert into seen_private.site_documents(id) values(true);
create table seen_private.admin_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('category','coupon','expense','order','message')),
  payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=32768),
  version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index admin_records_kind_created on seen_private.admin_records(kind,created_at desc);
create unique index category_slug on seen_private.admin_records((payload->>'slug')) where kind='category';
create unique index coupon_code on seen_private.admin_records((payload->>'code')) where kind='coupon';
create table seen_private.admin_audit (
  id bigint generated always as identity primary key, actor uuid references auth.users(id) on delete set null,
  action text not null, entity text not null, entity_id text, created_at timestamptz not null default now()
);
create table seen_private.site_history (
  version integer primary key, document jsonb not null, created_at timestamptz not null default now()
);
alter table seen_private.site_documents enable row level security;
alter table seen_private.site_history enable row level security;
alter table seen_private.admin_records enable row level security;
alter table seen_private.admin_audit enable row level security;
revoke all on all tables in schema seen_private from public,anon,authenticated;

alter table public.products add column photos jsonb not null default '[]'::jsonb check(jsonb_typeof(photos)='array' and jsonb_array_length(photos)<=12);
alter table public.products add column category text not null default '' check(length(category)<=100);
alter table public.products add column tone text not null default '' check(length(tone)<=80);
alter table public.products add column cost_pence integer check(cost_pence between 0 and 99999999);
-- Catalog edits must notice inventory/variant changes too. Otherwise a form
-- opened before a stock adjustment could silently restore the old quantity.
create or replace function seen_private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at=clock_timestamp(); return new; end $$;
create function seen_private.touch_product_from_child() returns trigger language plpgsql security definer set search_path = '' as $$
declare parent_id uuid;
begin
  if tg_table_name='inventory' then select product_id into parent_id from public.product_variants where id=new.variant_id;
  else parent_id:=new.product_id; end if;
  update public.products set updated_at=clock_timestamp() where id=parent_id;
  return new;
end $$;
create trigger inventory_admin_revision after insert or update on seen_private.inventory for each row execute function seen_private.touch_product_from_child();
create trigger variant_admin_revision after insert or update on public.product_variants for each row execute function seen_private.touch_product_from_child();
-- Keep costs and all draft records private, including from broad table SELECTs.
revoke select on public.products from anon,authenticated;
grant select(id,design_reference,name,description,price_pence,currency,status,details_confirmed,sort_order,created_at,updated_at,photos,category,tone) on public.products to anon,authenticated;
revoke select on public.product_variants from anon,authenticated;
grant select(id,product_id,size_label,active,sort_order,created_at,updated_at) on public.product_variants to anon,authenticated;

create function seen_private.audit(action text,entity text,entity_id text default null) returns void language sql security definer set search_path = '' as $$
  insert into seen_private.admin_audit(actor,action,entity,entity_id) values(auth.uid(),action,entity,entity_id);
$$;
create function public.get_site_document() returns jsonb language sql stable security definer set search_path = '' as $$ select published from seen_private.site_documents where id; $$;
revoke all on function public.get_site_document() from public;
grant execute on function public.get_site_document() to anon,authenticated;

create function public.admin_snapshot() returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  perform seen_private.require_admin();
  select jsonb_build_object(
    'site',(select to_jsonb(s) from seen_private.site_documents s where id),
    'products',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('variants',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('on_hand',coalesce(i.on_hand,0),'reserved',coalesce(i.reserved,0),'inventory_known',i.variant_id is not null) order by v.sort_order) from public.product_variants v left join seen_private.inventory i on i.variant_id=v.id where v.product_id=p.id),'[]'::jsonb)) order by p.sort_order) from public.products p),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from seen_private.admin_records where public.is_seen_admin(true) or kind='category' order by created_at desc limit 1000) r),'[]'::jsonb),
    'statistics',case when public.is_seen_admin(true) then jsonb_build_object(
      'recordCount',(select count(*) from seen_private.admin_records),
      'orderCount',(select count(*) from seen_private.admin_records where kind='order'),
      'paidPence',(select coalesce(sum(case when jsonb_typeof(payload->'total_pence')='number' then (payload->>'total_pence')::numeric else 0 end - case when jsonb_typeof(payload->'refunded_pence')='number' then (payload->>'refunded_pence')::numeric else 0 end),0) from seen_private.admin_records where kind='order' and payload->>'payment_status'='paid'),
      'expensePence',(select coalesce(sum((payload->>'amount_pence')::numeric),0) from seen_private.admin_records where kind='expense')
    ) else null end,
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from seen_private.admin_audit order by id desc limit 100) a),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('version',h.version,'created_at',h.created_at) order by version desc) from seen_private.site_history h),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.admin_save_site(document jsonb, expected_version integer, publish boolean default false) returns integer language plpgsql security definer set search_path = '' as $$
declare next_version integer;
begin
  perform seen_private.require_admin();
  if jsonb_typeof(document)<>'object' or octet_length(document::text)>524288 or not(document ?& array['text','media','hero','appearance','announcement','policies','featured']) then raise exception 'Invalid site document'; end if;
  if not public.is_seen_admin(true) and exists(select 1 from seen_private.site_documents where id and (document->'policies' is distinct from draft->'policies' or document->'announcement' is distinct from draft->'announcement' or document->'commerce' is distinct from draft->'commerce' or document->'text'->'info@seenabayas.co.uk' is distinct from draft->'text'->'info@seenabayas.co.uk')) then raise exception 'Owner access required for business settings' using errcode='42501'; end if;
  update seen_private.site_documents set draft=document,version=version+1,updated_at=now(),published=case when publish then document else published end,published_at=case when publish then now() else published_at end where id and version=expected_version returning version into next_version;
  if next_version is null then raise exception 'Content changed. Reload before saving.' using errcode='40001'; end if;
  if publish then
    insert into seen_private.site_history(version,document) values(next_version,document);
    delete from seen_private.site_history where version not in (select version from seen_private.site_history order by version desc limit 30);
  end if;
  perform seen_private.audit(case when publish then 'publish' else 'save draft' end,'site',next_version::text);
  return next_version;
end $$;
create function public.admin_restore_site(target_version integer,expected_version integer) returns integer language plpgsql security definer set search_path = '' as $$
declare doc jsonb;
begin
  perform seen_private.require_admin();
  select document into doc from seen_private.site_history where version=target_version;
  if doc is null then raise exception 'Revision unavailable'; end if;
  return public.admin_save_site(doc,expected_version,false);
end $$;

create function public.admin_save_product(product jsonb, expected_updated_at timestamptz default null) returns uuid language plpgsql security definer set search_path = '' as $$
declare pid uuid; item jsonb; vid uuid; current_timestamp_value timestamptz; position_value integer:=0;
begin
  perform seen_private.require_admin();
  if jsonb_typeof(product)<>'object' or jsonb_array_length(product->'variants') not between 1 and 50 then raise exception 'Invalid product'; end if;
  if coalesce(product->>'category','')<>'' and not exists(select 1 from seen_private.admin_records where kind='category' and payload->>'slug'=product->>'category') then raise exception 'Choose an existing category'; end if;
  pid:=coalesce(nullif(product->>'id','')::uuid,gen_random_uuid());
  select updated_at into current_timestamp_value from public.products where id=pid for update;
  if current_timestamp_value is not null and current_timestamp_value is distinct from expected_updated_at then raise exception 'Product changed. Reload before saving.' using errcode='40001'; end if;
  insert into public.products(id,design_reference,name,description,price_pence,status,details_confirmed,sort_order,photos,category,tone,cost_pence)
  values(pid,product->>'design_reference',nullif(product->>'name',''),nullif(product->>'description',''),(product->>'price_pence')::integer,product->>'status',(product->>'details_confirmed')::boolean,(product->>'sort_order')::integer,product->'photos',product->>'category',product->>'tone',(product->>'cost_pence')::integer)
  on conflict(id) do update set design_reference=excluded.design_reference,name=excluded.name,description=excluded.description,price_pence=excluded.price_pence,status=excluded.status,details_confirmed=excluded.details_confirmed,sort_order=excluded.sort_order,photos=excluded.photos,category=excluded.category,tone=excluded.tone,cost_pence=excluded.cost_pence;
  update public.product_variants set active=false where product_id=pid;
  for item in select * from jsonb_array_elements(product->'variants') loop
    vid:=coalesce(nullif(item->>'id','')::uuid,gen_random_uuid());
    if exists(select 1 from public.product_variants where id=vid and product_id<>pid) then raise exception 'Invalid variant'; end if;
    insert into public.product_variants(id,product_id,size_label,sku,active,sort_order) values(vid,pid,item->>'size_label',nullif(item->>'sku',''),(item->>'active')::boolean,position_value)
    on conflict(id) do update set size_label=excluded.size_label,sku=excluded.sku,active=excluded.active,sort_order=excluded.sort_order;
    insert into seen_private.inventory(variant_id,on_hand) values(vid,(item->>'on_hand')::integer) on conflict(variant_id) do update set on_hand=excluded.on_hand;
    position_value:=position_value+1;
  end loop;
  if product->>'status'='published' and jsonb_array_length(product->'photos')=0 then raise exception 'Published products need photography'; end if;
  perform seen_private.audit('save','product',pid::text);
  return pid;
end $$;
create function public.admin_bulk_products(ids uuid[],operation text,quantity integer default null) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform seen_private.require_admin();
  if cardinality(ids) not between 1 and 500 then raise exception 'Invalid selection'; end if;
  if operation='archive' then update public.products set status='archived' where id=any(ids);
  elsif operation='stock' and quantity between 0 and 1000000 then update seen_private.inventory set on_hand=quantity where variant_id in (select id from public.product_variants where product_id=any(ids));
  elsif operation='reorder' then update public.products p set sort_order=r.ordinality::integer from unnest(ids) with ordinality r(id,ordinality) where p.id=r.id;
  else raise exception 'Invalid operation'; end if;
  perform seen_private.audit(operation,'products',cardinality(ids)::text);
end $$;

create function public.admin_save_record(record_kind text, record_id uuid, data jsonb,expected_version integer default 0) returns uuid language plpgsql security definer set search_path = '' as $$
declare rid uuid:=coalesce(record_id,gen_random_uuid()); current_row seen_private.admin_records; permitted boolean;
begin
  perform seen_private.require_admin(record_kind<>'category');
  if record_kind not in ('category','coupon','expense','order','message') then raise exception 'Invalid record'; end if;
  select * into current_row from seen_private.admin_records where id=rid for update;
  if current_row.id is not null and (current_row.kind<>record_kind or current_row.version<>expected_version) then raise exception 'Record changed. Reload before saving.' using errcode='40001'; end if;
  if record_kind in ('order','message') then
    if current_row.id is null then raise exception 'Records are created by trusted integrations only'; end if;
    if record_kind='order' then
      if data - array['status','tracking','notes'] <> '{}'::jsonb or data->>'status' not in ('pending','confirmed','processing','shipped','completed','cancelled') then raise exception 'Invalid order change'; end if;
      if current_row.payload->>'status' in ('completed','cancelled') and data->>'status'<>current_row.payload->>'status' then raise exception 'Closed orders cannot be reopened'; end if;
      if data->>'status' in ('processing','shipped','completed') and current_row.payload->>'payment_status' is distinct from 'paid' then raise exception 'Payment must be verified by the payment provider'; end if;
    elsif data - array['read','archived','notes'] <> '{}'::jsonb then raise exception 'Invalid message change'; end if;
    data:=current_row.payload||data;
  end if;
  if record_kind='category' and (coalesce(length(data->>'name'),0) not between 1 and 150 or coalesce(data->>'slug','') !~ '^[a-z0-9-]{1,100}$') then raise exception 'Invalid category'; end if;
  if record_kind='expense' and (coalesce(length(data->>'title'),0) not between 1 and 150 or coalesce((data->>'amount_pence')::integer,0) not between 1 and 99999999) then raise exception 'Invalid expense'; end if;
  if record_kind='coupon' and (coalesce(data->>'code','') !~ '^[A-Z0-9_-]{3,40}$' or coalesce(data->>'type','') not in ('percent','fixed') or coalesce((data->>'value')::integer,0)<1 or (data->>'type'='percent' and (data->>'value')::integer>100)) then raise exception 'Invalid coupon'; end if;
  if record_kind='category' and current_row.id is not null and current_row.payload->>'slug' is distinct from data->>'slug' then update public.products set category=data->>'slug' where category=current_row.payload->>'slug'; end if;
  if current_row.id is null then insert into seen_private.admin_records(id,kind,payload) values(rid,record_kind,data);
  else update seen_private.admin_records set payload=data,version=version+1,updated_at=now() where id=rid; end if;
  perform seen_private.audit('save',record_kind,rid::text); return rid;
end $$;
create function public.admin_delete_record(record_id uuid,expected_version integer) returns void language plpgsql security definer set search_path = '' as $$
declare current_row seen_private.admin_records;
begin
  perform seen_private.require_admin(true);
  select * into current_row from seen_private.admin_records where id=record_id for update;
  if current_row.version is distinct from expected_version then raise exception 'Record changed'; end if;
  if current_row.kind='order' then raise exception 'Retain order history; cancel the order instead'; end if;
  if current_row.kind='category' and exists(select 1 from public.products where category=current_row.payload->>'slug') then raise exception 'Move products out of this category first'; end if;
  delete from seen_private.admin_records where id=record_id;
  perform seen_private.audit('delete',current_row.kind,record_id::text);
end $$;
create function public.get_storefront_catalog_v2() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('photos',p.photos,'tone',p.tone,'category',p.category,'category_name',coalesce((select r.payload->>'name' from seen_private.admin_records r where r.kind='category' and r.payload->>'slug'=p.category),p.category)) order by p.sort_order),'[]'::jsonb) from public.get_storefront_catalog() c join public.products p on p.id=c.product_id;
$$;
revoke all on function public.get_storefront_catalog_v2() from public;
grant execute on function public.get_storefront_catalog_v2() to anon,authenticated;

-- No direct grants to private records. All writes run through checked functions.
revoke all on function public.admin_snapshot(),public.admin_save_site(jsonb,integer,boolean),public.admin_restore_site(integer,integer),public.admin_save_product(jsonb,timestamptz),public.admin_bulk_products(uuid[],text,integer),public.admin_save_record(text,uuid,jsonb,integer),public.admin_delete_record(uuid,integer) from public,anon;
grant execute on function public.admin_snapshot(),public.admin_save_site(jsonb,integer,boolean),public.admin_restore_site(integer,integer),public.admin_save_product(jsonb,timestamptz),public.admin_bulk_products(uuid[],text,integer),public.admin_save_record(text,uuid,jsonb,integer),public.admin_delete_record(uuid,integer) to authenticated;
-- Only a verified server integration may create customer messages. Never grant
-- this function to anon/authenticated or expose the service key in the browser.
create function public.record_verified_enquiry(request_id uuid, message jsonb) returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(length(message->>'name'),0) not between 2 and 100 or coalesce(length(message->>'email'),0) not between 3 and 254 or coalesce(length(message->>'phone'),0) not between 7 and 40 or coalesce(length(message->>'message'),0) not between 10 and 5000 then raise exception 'Invalid enquiry'; end if;
  insert into seen_private.admin_records(id,kind,payload) values(request_id,'message',jsonb_build_object('name',message->>'name','email',message->>'email','phone',message->>'phone','message',message->>'message','submitted_at',message->>'submittedAt','read',false,'archived',false,'notes','')) on conflict(id) do nothing;
end $$;
revoke all on function public.record_verified_enquiry(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_verified_enquiry(uuid,jsonb) to service_role;
revoke all on all functions in schema seen_private from public,anon,authenticated;
commit;
