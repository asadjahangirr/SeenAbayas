-- Royal Mail configuration privacy, shared quote limits and server-verified quote orders.
-- Apply after the existing payment/admin/contact migrations. Safe to rerun.
-- Installs capability only: no existing prices, stock, orders or shipping mode are changed.
begin;

create or replace function public.get_site_document() returns jsonb language sql stable security definer set search_path='' as $$
  select case when published is null then null else jsonb_set(published,'{shipping}',
    jsonb_build_object('mode',coalesce(published#>>'{shipping,mode}','fixed')),true) end
  from seen_private.site_documents where id;
$$;
create or replace function public.get_shipping_settings() returns jsonb language sql stable security definer set search_path='' as $$
  select published->'shipping' from seen_private.site_documents where id;
$$;
create or replace function seen_private.guard_shipping_settings() returns trigger language plpgsql set search_path='' as $$
declare defaults jsonb:='{"mode":"fixed","accountType":"unknown","dispatchPostcode":"","packagingWeightGrams":null,"lengthMm":null,"widthMm":null,"heightMm":null,"packageFormat":"SmallParcel","maxItemsPerParcel":null,"standardServiceCode":"","expressServiceCode":"","priceBasis":"unconfirmed","variantWeights":{}}'::jsonb;
begin
  if auth.uid() is not null and not public.is_seen_admin(true) and (
    coalesce(new.draft->'shipping',defaults) is distinct from coalesce(old.draft->'shipping',defaults)
    or coalesce(new.published->'shipping',defaults) is distinct from coalesce(old.published->'shipping',defaults)
  ) then
    raise exception 'Owner access required for shipping settings' using errcode='42501';
  end if;
  return new;
end $$;

drop trigger if exists guard_shipping_settings on seen_private.site_documents;
create trigger guard_shipping_settings before update on seen_private.site_documents
  for each row execute function seen_private.guard_shipping_settings();

create table if not exists seen_private.shipping_quote_guard(id integer primary key check(id=1));
insert into seen_private.shipping_quote_guard(id) values(1) on conflict do nothing;
create table if not exists seen_private.shipping_quote_attempts(
  id bigint generated always as identity primary key,owner_hash text not null,network_hash text not null,
  created_at timestamptz not null default clock_timestamp());
create index if not exists shipping_quote_attempt_time on seen_private.shipping_quote_attempts(created_at);
create index if not exists shipping_quote_attempt_owner on seen_private.shipping_quote_attempts(owner_hash,created_at);
create index if not exists shipping_quote_attempt_network on seen_private.shipping_quote_attempts(network_hash,created_at);
alter table seen_private.shipping_quote_guard enable row level security;
alter table seen_private.shipping_quote_attempts enable row level security;
revoke all on seen_private.shipping_quote_guard,seen_private.shipping_quote_attempts from public,anon,authenticated,service_role;

create or replace function public.shipping_quote_attempt(owner_hash text,network_hash text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if coalesce(owner_hash,'') !~ '^[a-f0-9]{64}$' or coalesce(network_hash,'') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid delivery identity'; end if;
  perform 1 from seen_private.shipping_quote_guard where id=1 for update;
  if not found then raise exception 'Delivery quote limits are unavailable'; end if;
  if (select count(*) from seen_private.shipping_quote_attempts where created_at>clock_timestamp()-interval '1 minute')>=60
    or (select count(*) from seen_private.shipping_quote_attempts a where a.owner_hash=shipping_quote_attempt.owner_hash and created_at>clock_timestamp()-interval '1 minute')>=10
    or (select count(*) from seen_private.shipping_quote_attempts a where a.network_hash=shipping_quote_attempt.network_hash and created_at>clock_timestamp()-interval '1 minute')>=30 then
    raise exception 'Delivery quote rate limit exceeded';
  end if;
  insert into seen_private.shipping_quote_attempts(owner_hash,network_hash) values(owner_hash,network_hash);
  delete from seen_private.shipping_quote_attempts where created_at<clock_timestamp()-interval '1 day';
end $$;

create or replace function public.payment_prepare_order_v3(request_id uuid,owner_hash text,request_hash text,details jsonb,requested_lines jsonb,shipping_method text,expected_delivery bigint,return_origin text,payment_mode text,quoted_delivery jsonb,expected_shipping jsonb,expected_commerce jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; target uuid:=gen_random_uuid(); item jsonb; p public.products; v public.product_variants; inv seen_private.inventory;
  doc jsonb; subtotal bigint:=0; shipping bigint; threshold bigint; minimum bigint; snapshot jsonb; n integer; number text; total_weight bigint:=0; total_items integer:=0;
begin
  if payment_mode is null or payment_mode not in ('test','live') then raise exception 'Invalid payment mode'; end if;
  if request_id is null or owner_hash !~ '^[a-f0-9]{64}$' or request_hash !~ '^[a-f0-9]{64}$' or owner_hash is null or request_hash is null then raise exception 'Invalid checkout identity'; end if;
  perform pg_advisory_xact_lock(hashtext(owner_hash)::bigint);
  existing:=public.payment_get_request(request_id,owner_hash,request_hash);
  if existing is not null then
    if (existing->>'is_test')::boolean is distinct from (payment_mode='test') then raise exception 'Checkout request does not match payment mode'; end if;
    return existing;
  end if;
  if jsonb_typeof(requested_lines)<>'array' or jsonb_array_length(requested_lines) not between 1 and 20 then raise exception 'Invalid checkout selection'; end if;
  if (select count(distinct x->>'variant_id') from jsonb_array_elements(requested_lines) x)<>jsonb_array_length(requested_lines) then raise exception 'Duplicate checkout sizes'; end if;
  for item in select value from jsonb_array_elements(requested_lines) loop
    if jsonb_typeof(item)<>'object' or item-array['variant_id','quantity','unit_price_pence']<>'{}'::jsonb
      or coalesce(item->>'variant_id','') !~ '^[0-9a-f-]{36}$' or coalesce(item->>'quantity','') !~ '^[0-9]{1,2}$'
      or (item->>'quantity')::integer not between 1 and 10 then raise exception 'Invalid checkout selection'; end if;
  end loop;
  if details->>'country' is distinct from 'GB' or coalesce(length(details->>'email'),0) not between 3 and 254 or coalesce(length(details->>'firstName'),0) not between 1 and 80
    or coalesce(length(details->>'lastName'),0) not between 1 and 80 or coalesce(length(details->>'addressLine1'),0) not between 1 and 150 or octet_length(details::text)>5000 then raise exception 'Invalid delivery details'; end if;
  if return_origin !~ '^https://[^/]+$' and return_origin !~ '^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$' then raise exception 'Invalid return origin'; end if;
  if (select count(*) from seen_private.checkout_orders o where o.owner_hash=payment_prepare_order_v3.owner_hash and o.stock_state='reserved')>=3 then raise exception 'Finish or cancel an existing checkout before opening another'; end if;

  -- Lock products before inventory, matching the existing admin write order.
  perform 1 from public.products lock_product where lock_product.id in(select lock_variant.product_id from public.product_variants lock_variant where lock_variant.id in(select (x->>'variant_id')::uuid from jsonb_array_elements(requested_lines) x)) order by lock_product.id for update;
  select published into doc from seen_private.site_documents where id for share;
  doc:=coalesce(doc,'{}'::jsonb);
  for item in select value from jsonb_array_elements(requested_lines) order by value->>'variant_id' loop
    select * into v from public.product_variants where id=(item->>'variant_id')::uuid for update;
    select * into p from public.products where id=v.product_id;
    select * into inv from seen_private.inventory where variant_id=v.id for update;
    if v.id is null or not v.active or p.status is distinct from 'published' or not p.details_confirmed or inv.variant_id is null then raise exception 'A selected size is no longer available'; end if;
    n:=(item->>'quantity')::integer;
    if inv.on_hand-inv.reserved<n then raise exception 'Stock changed. Reduce the quantity or choose another size'; end if;
    if p.price_pence is distinct from (item->>'unit_price_pence')::integer then raise exception 'Prices changed. Review your selection again'; end if;
    subtotal:=subtotal+p.price_pence::bigint*n;
    if coalesce((doc#>>array['shipping','variantWeights',v.id::text])::bigint,0) not between 1 and 20000 then raise exception 'Delivery measurements are not configured'; end if;
    total_weight:=total_weight+(doc#>>array['shipping','variantWeights',v.id::text])::bigint*n; total_items:=total_items+n;
  end loop;
  threshold:=coalesce((doc#>>'{commerce,freeDeliveryThresholdPence}')::bigint,8000);
  minimum:=coalesce((doc#>>'{commerce,minimumOrderPence}')::bigint,0);
  if subtotal<minimum then raise exception 'Selection is below the minimum order value'; end if;
  if doc->'shipping' is distinct from expected_shipping or doc->'commerce' is distinct from expected_commerce
    or doc#>>'{shipping,mode}' is distinct from 'royal_mail_olp'
    or doc#>>'{shipping,accountType}' is distinct from 'olp'
    or doc#>>'{shipping,priceBasis}' not in ('cost_includes_vat','cost_plus_vat') then raise exception 'Delivery settings changed. Review again'; end if;
  if jsonb_typeof(quoted_delivery) is distinct from 'object' or octet_length(quoted_delivery::text)>2000
    or quoted_delivery->>'source' is distinct from 'royal_mail_olp' or quoted_delivery->>'carrier' is distinct from 'Royal Mail'
    or quoted_delivery->>'id' is distinct from shipping_method
    or coalesce((quoted_delivery->>'expiresAt')::bigint,0) <= floor(extract(epoch from clock_timestamp())*1000)::bigint
    or (quoted_delivery->>'expiresAt')::bigint > floor(extract(epoch from clock_timestamp())*1000)::bigint+310000
    or coalesce(quoted_delivery->>'serviceCode','')='' then raise exception 'Delivery quote expired or is invalid'; end if;
  total_weight:=total_weight+coalesce((doc#>>'{shipping,packagingWeightGrams}')::bigint,-1000000);
  if total_items>coalesce((doc#>>'{shipping,maxItemsPerParcel}')::integer,0)
    or total_weight not between 1 and (case when doc#>>'{shipping,packageFormat}'='SmallParcel' then 2000 else 20000 end)
    or total_weight is distinct from (quoted_delivery->>'weightInGrams')::bigint
    or doc#>>'{shipping,packageFormat}' is distinct from quoted_delivery->>'packageFormat'
    then raise exception 'Delivery measurements changed. Review again'; end if;
  if shipping_method='standard' then
    if quoted_delivery->>'serviceCode' is distinct from doc#>>'{shipping,standardServiceCode}' then raise exception 'Delivery service changed. Review again'; end if;
    shipping:=case when coalesce((doc#>>'{commerce,freeDeliveryEnabled}')::boolean,true) and subtotal>=threshold then 0 else (quoted_delivery->>'carrierCostPence')::bigint end;
  elsif shipping_method='express' and coalesce((doc#>>'{policies,delivery,expressAvailable}')::boolean,false) then
    if quoted_delivery->>'serviceCode' is distinct from doc#>>'{shipping,expressServiceCode}' then raise exception 'Delivery service changed. Review again'; end if;
    shipping:=(quoted_delivery->>'carrierCostPence')::bigint;
  else raise exception 'Delivery option is unavailable'; end if;
  if shipping is null or shipping not between 0 and 99999999
    or coalesce((quoted_delivery->>'carrierCostPence')::bigint,-1) not between 0 and 99999999
    or shipping is distinct from expected_delivery or shipping is distinct from (quoted_delivery->>'chargePence')::bigint
    then raise exception 'Delivery charges changed. Review again'; end if;
  number:=case when payment_mode='test' then 'SEEN-T-' else 'SEEN-' end||upper(substr(replace(target::text,'-',''),1,12));
  insert into seen_private.checkout_orders(id,request_id,owner_hash,request_hash,order_number,is_test,details,delivery,subtotal_pence,delivery_pence,total_pence,return_origin)
  values(target,request_id,owner_hash,request_hash,number,payment_mode='test',details,quoted_delivery,subtotal,shipping,subtotal+shipping,return_origin);
  for item in select value from jsonb_array_elements(requested_lines) order by value->>'variant_id' loop
    select * into v from public.product_variants where id=(item->>'variant_id')::uuid;
    select * into p from public.products where id=v.product_id;
    n:=(item->>'quantity')::integer;
    snapshot:=jsonb_build_object('product_id',p.id,'variant_id',v.id,'design_reference',p.design_reference,'name',p.name,'size',v.size_label,'quantity',n,'unit_price_pence',p.price_pence,'photo',p.photos->0);
    insert into seen_private.checkout_items(order_id,variant_id,product_id,quantity,unit_price_pence,snapshot) values(target,v.id,p.id,n,p.price_pence,snapshot);
    update seen_private.inventory set reserved=reserved+n where variant_id=v.id;
  end loop;
  insert into seen_private.admin_records(id,kind,payload) values(target,'order',jsonb_build_object(
    'order_number',number,'name',concat(details->>'firstName',' ',details->>'lastName'),'email',details->>'email','phone',details->>'phone',
    'address',details,'items',(select jsonb_agg(saved_item.snapshot order by saved_item.variant_id) from seen_private.checkout_items saved_item where saved_item.order_id=target),
    'subtotal_pence',subtotal,'delivery_pence',shipping,'total_pence',subtotal+shipping,'currency','GBP','delivery_method',shipping_method,
    'payment_status','unpaid','status','pending','is_test',payment_mode='test','stock_state','reserved','tracking','','notes',''));
  perform seen_private.sync_checkout_order_record(target);
  return seen_private.payment_order_json(target);
end $$;

-- Earlier deployed code cannot silently substitute a fixed fee in carrier mode.
create or replace function seen_private.guard_carrier_checkout() returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from seen_private.site_documents where id and published#>>'{shipping,mode}'='royal_mail_olp')
    and new.delivery->>'source' is distinct from 'royal_mail_olp' then
    raise exception 'Delivery quote is required. Review again';
  end if;
  return new;
end $$;
drop trigger if exists guard_carrier_checkout on seen_private.checkout_orders;
create trigger guard_carrier_checkout before insert on seen_private.checkout_orders
  for each row execute function seen_private.guard_carrier_checkout();

create or replace function public.shipping_health() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('quotes_ready',true,'fulfilment_ready',false);
$$;
create or replace function public.admin_shipping_health() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_seen_admin(true) then raise exception 'Owner access required' using errcode='42501'; end if;
  return public.shipping_health();
end $$;
revoke all on function public.admin_shipping_health() from public,anon,service_role;
grant execute on function public.admin_shipping_health() to authenticated;
revoke all on function public.get_shipping_settings(),public.shipping_quote_attempt(text,text),public.shipping_health(),
  public.payment_prepare_order_v3(uuid,text,text,jsonb,jsonb,text,bigint,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.get_shipping_settings(),public.shipping_quote_attempt(text,text),public.shipping_health(),
  public.payment_prepare_order_v3(uuid,text,text,jsonb,jsonb,text,bigint,text,text,jsonb,jsonb,jsonb) to service_role;
revoke all on function seen_private.guard_shipping_settings(),seen_private.guard_carrier_checkout() from public,anon,authenticated,service_role;
commit;
