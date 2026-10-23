-- Trusted checkout coupons. Apply after multi_parcel_shipping and order_emails.
-- Installs private redemption accounting and the requested editable FREEDEL code.
-- No existing orders, payments, stock or delivery settings are changed.
begin;
alter table seen_private.checkout_orders add column if not exists discount_pence bigint not null default 0 check(discount_pence>=0);
alter table seen_private.checkout_orders add column if not exists coupon jsonb;
alter table seen_private.checkout_orders drop constraint if exists checkout_orders_total_pence_check;
alter table seen_private.checkout_orders drop constraint if exists checkout_orders_discount_total;
-- PostgreSQL can name the original cross-column check checkout_orders_check.
-- Match its exact expression, rather than dropping an unrelated table check.
do $$ declare legacy record; begin
  for legacy in select conname from pg_constraint
    where conrelid='seen_private.checkout_orders'::regclass and contype='c'
      and regexp_replace(pg_get_constraintdef(oid),'[[:space:]()]','','g')='CHECKtotal_pence=subtotal_pence+delivery_pence'
  loop execute format('alter table seen_private.checkout_orders drop constraint %I',legacy.conname); end loop;
end $$;
alter table seen_private.checkout_orders add constraint checkout_orders_discount_total check(discount_pence<subtotal_pence and total_pence=subtotal_pence-discount_pence+delivery_pence);
create table if not exists seen_private.checkout_coupon_uses(
  order_id uuid primary key references seen_private.checkout_orders(id),
  coupon_id uuid references seen_private.admin_records(id) on delete set null,
  is_test boolean not null,state text not null default 'reserved' check(state in ('reserved','used','released')),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists checkout_coupon_usage on seen_private.checkout_coupon_uses(coupon_id,is_test,state);
create table if not exists seen_private.checkout_coupon_attempts(network_hash text not null,created_at timestamptz not null default clock_timestamp());
create index if not exists checkout_coupon_attempt_time on seen_private.checkout_coupon_attempts(network_hash,created_at);
alter table seen_private.checkout_coupon_uses enable row level security;
alter table seen_private.checkout_coupon_attempts enable row level security;
revoke all on seen_private.checkout_coupon_uses,seen_private.checkout_coupon_attempts from public,anon,authenticated,service_role;

create or replace function public.checkout_coupon_attempt(network_hash text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if network_hash is null then raise exception 'Discount code is unavailable'; end if;
    if network_hash !~ '^[a-f0-9]{64}$' then raise exception 'Discount code is unavailable'; end if;
    perform pg_advisory_xact_lock(hashtext('seen-coupon-apply-limit')::bigint);
    if (select count(*) from seen_private.checkout_coupon_attempts a where a.created_at>clock_timestamp()-interval '1 minute')>=60
      or (select count(*) from seen_private.checkout_coupon_attempts a where a.network_hash=checkout_coupon_attempt.network_hash and a.created_at>clock_timestamp()-interval '1 minute')>=20
      then raise exception 'Discount code checks are temporarily limited. Please try again shortly'; end if;
    insert into seen_private.checkout_coupon_attempts(network_hash) values(network_hash);
    delete from seen_private.checkout_coupon_attempts where created_at<clock_timestamp()-interval '15 minutes';
end $$;

create or replace function public.checkout_coupon_quote(code text,subtotal_pence bigint,payment_mode text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry seen_private.admin_records; discount bigint:=0; usage bigint; kind text; value bigint; expires timestamptz;
begin
  if payment_mode not in ('test','live') or payment_mode is null or subtotal_pence is null or subtotal_pence<=0
    or coalesce(upper(btrim(code)),'') !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'Discount code is unavailable'; end if;
  select * into entry from seen_private.admin_records r where r.kind='coupon' and upper(r.payload->>'code')=upper(btrim(code));
  if entry.id is null or entry.payload->>'active' is distinct from 'true' then raise exception 'Discount code is unavailable'; end if;
  if entry.payload->>'expires_at' is not null then
    expires:=(entry.payload->>'expires_at')::timestamptz;
    if expires<=clock_timestamp() then raise exception 'Discount code has expired'; end if;
  end if;
  if subtotal_pence<coalesce((entry.payload->>'min_subtotal_pence')::bigint,0) then raise exception 'Discount code minimum order value has not been reached'; end if;
  if entry.payload->>'usage_limit' is not null then
    select count(*) into usage from seen_private.checkout_coupon_uses u where u.coupon_id=entry.id and u.is_test=(payment_mode='test') and u.state in ('reserved','used');
    if usage>=(entry.payload->>'usage_limit')::bigint then raise exception 'Discount code has reached its usage limit'; end if;
  end if;
  kind:=entry.payload->>'type';value:=coalesce((entry.payload->>'value')::bigint,0);
  if kind='percent' and value between 1 and 100 then discount:=subtotal_pence*value/100;
  elsif kind='fixed' and value>0 then discount:=value;
  elsif kind='free_delivery' then discount:=0;
  else raise exception 'Discount code is unavailable'; end if;
  if discount>=subtotal_pence or subtotal_pence-discount<30 then raise exception 'Discount code cannot be applied to this order total'; end if;
  return jsonb_build_object('id',entry.id,'code',upper(entry.payload->>'code'),'type',kind,'value',value,'discountPence',discount,'freeDelivery',kind='free_delivery','version',entry.version);
end $$;

create or replace function seen_private.settle_checkout_coupon() returns trigger language plpgsql set search_path='' as $$
begin
  if new.state in ('paid','attention') then update seen_private.checkout_coupon_uses set state='used' where order_id=new.id and state<>'used';
  elsif new.state in ('failed','expired') then update seen_private.checkout_coupon_uses set state='released' where order_id=new.id and state='reserved'; end if;
  return new;
end $$;
drop trigger if exists settle_checkout_coupon on seen_private.checkout_orders;
create trigger settle_checkout_coupon after update of state on seen_private.checkout_orders for each row execute function seen_private.settle_checkout_coupon();
create or replace function seen_private.protect_purchase_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_table_name='checkout_items' then
    raise exception 'Purchase item snapshots cannot be changed';
  end if;
  if (new.request_id,new.owner_hash,new.request_hash,new.order_number,new.is_test,
      new.subtotal_pence,new.delivery_pence,new.total_pence,new.currency,new.delivery,new.discount_pence,new.coupon)
    is distinct from
     (old.request_id,old.owner_hash,old.request_hash,old.order_number,old.is_test,
      old.subtotal_pence,old.delivery_pence,old.total_pence,old.currency,old.delivery,old.discount_pence,old.coupon) then
    raise exception 'Purchase totals and identity cannot be changed';
  end if;
  if old.state='paid' and new.details is distinct from old.details then
    raise exception 'Confirmed customer details cannot be changed';
  end if;
  return new;
end $$;
create or replace function seen_private.sync_checkout_order_record(target uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders; current_row seen_private.admin_records;
  purchased jsonb; payload_value jsonb; subtotal bigint; fulfilment text;
begin
  select * into o from seen_private.checkout_orders where id=target for update;
  if o.id is null then raise exception 'Payment order not found'; end if;
  select * into current_row from seen_private.admin_records where id=target for update;
  if current_row.id is not null and current_row.kind<>'order' then raise exception 'Order record identity conflict'; end if;
  select jsonb_agg(i.snapshot||jsonb_build_object(
    'product_id',i.product_id,'variant_id',i.variant_id,'quantity',i.quantity,
    'unit_price_pence',i.unit_price_pence,'line_total_pence',i.unit_price_pence::bigint*i.quantity
  ) order by i.variant_id),sum(i.unit_price_pence::bigint*i.quantity)
  into purchased,subtotal from seen_private.checkout_items i where i.order_id=o.id;
  if purchased is null or subtotal is distinct from o.subtotal_pence then raise exception 'Purchase snapshots do not match the order total'; end if;
  fulfilment:=case
    when o.state='paid' then case
      when current_row.payload->>'status' in ('confirmed','processing','shipped','completed','cancelled') then current_row.payload->>'status'
      else 'confirmed' end
    when o.state in ('failed','expired') then 'cancelled'
    else 'pending' end;
  payload_value:=coalesce(current_row.payload,'{}'::jsonb)||jsonb_build_object(
    'source','stripe_checkout','order_number',o.order_number,
    'name',coalesce(nullif(o.details->>'recipientName',''),concat(o.details->>'firstName',' ',o.details->>'lastName')),
    'email',o.details->>'email','phone',coalesce(o.details->>'phone',''),
    'address',o.details,'items',purchased,'delivery',o.delivery,
    'discount_pence',o.discount_pence,'coupon',o.coupon,'subtotal_pence',o.subtotal_pence,'delivery_pence',o.delivery_pence,'total_pence',o.total_pence,
    'tax_pence',o.tax_pence,'refunded_pence',o.refunded_pence,'currency','GBP','delivery_method',o.delivery->>'id',
    'payment_status',case when o.state in ('paid','attention') then 'paid' when o.state in ('failed','expired') then o.state else 'unpaid' end,
    'checkout_state',o.state,'status',fulfilment,'is_test',o.is_test,'stock_state',o.stock_state,
    'needs_attention',o.state='attention','stripe_session_id',o.session_id,'payment_intent',o.payment_intent,
    'payment_verified_at',o.payment_verified_at,'confirmed_at',o.confirmed_at,
    'tracking',coalesce(current_row.payload->>'tracking',''),'notes',coalesce(current_row.payload->>'notes','')
  );
  insert into seen_private.admin_records(id,kind,payload,created_at,updated_at)
  values(o.id,'order',payload_value,o.created_at,clock_timestamp())
  on conflict(id) do update set payload=excluded.payload,
    version=seen_private.admin_records.version+1,updated_at=excluded.updated_at
    where seen_private.admin_records.payload is distinct from excluded.payload;
end $$;

create or replace function seen_private.queue_paid_order_emails() returns trigger
language plpgsql security definer set search_path='' as $$
declare purchase jsonb;
begin
  -- Only canonical, verified, confirmed transitions generate notifications.
  -- Admin-editable order records and visits to a success URL cannot enqueue.
  if new.state<>'paid' or old.state='paid' or new.payment_verified_at is null or new.confirmed_at is null then return new; end if;
  select jsonb_build_object(
    'id',new.id,'order_number',new.order_number,'is_test',new.is_test,
    'details',new.details,'delivery',new.delivery,'currency',new.currency,
    'discount_pence',new.discount_pence,'coupon',new.coupon,'subtotal_pence',new.subtotal_pence,'delivery_pence',new.delivery_pence,
    'tax_pence',new.tax_pence,'total_pence',new.total_pence,
    'confirmed_at',new.confirmed_at,
    'items',(select jsonb_agg(i.snapshot order by i.variant_id) from seen_private.checkout_items i where i.order_id=new.id)
  ) into purchase;
  insert into seen_private.order_emails(order_id,kind,snapshot)
  values(new.id,'customer_confirmation',purchase),(new.id,'owner_notification',purchase)
  on conflict(order_id,kind) do nothing;
  return new;
end $$;
create or replace function public.payment_prepare_order_v4(request_id uuid,owner_hash text,request_hash text,details jsonb,requested_lines jsonb,shipping_method text,expected_delivery bigint,return_origin text,payment_mode text,quoted_delivery jsonb,expected_shipping jsonb,expected_commerce jsonb,coupon_code text,expected_coupon jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; target uuid:=gen_random_uuid(); item jsonb; p public.products; v public.product_variants; inv seen_private.inventory;
  doc jsonb; subtotal bigint:=0; shipping bigint; threshold bigint; minimum bigint; snapshot jsonb; n integer; number text; total_weight bigint:=0; total_items integer:=0; plan jsonb; quoted_parcel jsonb; parcel_index integer; parcel_cost bigint:=0; coupon_value jsonb; discount bigint:=0; coupon_record uuid; carrier_mode boolean;
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
  if (select count(*) from seen_private.checkout_orders o where o.owner_hash=payment_prepare_order_v4.owner_hash and o.stock_state='reserved')>=3 then raise exception 'Finish or cancel an existing checkout before opening another'; end if;

  -- Serialize claims for this coupon before locking merchandise.
  select id into coupon_record from seen_private.admin_records where kind='coupon' and upper(payload->>'code')=upper(btrim(coupon_code)) for update;
  if coupon_record is null then raise exception 'Discount code is unavailable'; end if;
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
    if doc#>>'{shipping,mode}'='royal_mail_olp' and coalesce((doc#>>array['shipping','variantWeights',v.id::text])::bigint,0) not between 1 and 20000 then raise exception 'Delivery measurements are not configured'; end if;
    total_weight:=total_weight+(doc#>>array['shipping','variantWeights',v.id::text])::bigint*n; total_items:=total_items+n;
  end loop;
  threshold:=coalesce((doc#>>'{commerce,freeDeliveryThresholdPence}')::bigint,8000);
  minimum:=coalesce((doc#>>'{commerce,minimumOrderPence}')::bigint,0);
  if subtotal<minimum then raise exception 'Selection is below the minimum order value'; end if;
  coupon_value:=public.checkout_coupon_quote(coupon_code,subtotal,payment_mode);
  if coupon_value is distinct from expected_coupon then raise exception 'Discount code changed. Review your order again'; end if;
  discount:=(coupon_value->>'discountPence')::bigint;
  carrier_mode:=doc#>>'{shipping,mode}'='royal_mail_olp';
  if doc->'commerce' is distinct from expected_commerce then raise exception 'Delivery settings changed. Review again'; end if;
  if carrier_mode then
  if doc->'shipping' is distinct from expected_shipping or doc->'commerce' is distinct from expected_commerce
    or doc#>>'{shipping,mode}' is distinct from 'royal_mail_olp'
    or doc#>>'{shipping,accountType}' is distinct from 'olp'
    or doc#>>'{shipping,priceBasis}' not in ('cost_includes_vat','cost_plus_vat') then raise exception 'Delivery settings changed. Review again'; end if;
  if jsonb_typeof(quoted_delivery) is distinct from 'object' or octet_length(quoted_delivery::text)>8192
    or quoted_delivery->>'source' is distinct from 'royal_mail_olp' or quoted_delivery->>'carrier' is distinct from 'Royal Mail'
    or quoted_delivery->>'id' is distinct from shipping_method
    or coalesce((quoted_delivery->>'expiresAt')::bigint,0) <= floor(extract(epoch from clock_timestamp())*1000)::bigint
    or (quoted_delivery->>'expiresAt')::bigint > floor(extract(epoch from clock_timestamp())*1000)::bigint+310000
    or coalesce(quoted_delivery->>'serviceCode','')='' then raise exception 'Delivery quote expired or is invalid'; end if;
  plan:=seen_private.shipping_parcel_plan(doc->'shipping',requested_lines);
  select sum((parcel_row->>'weightInGrams')::bigint) into total_weight from jsonb_array_elements(plan) parcel_row;
  if total_weight is distinct from (quoted_delivery->>'weightInGrams')::bigint
    or doc#>>'{shipping,packageFormat}' is distinct from quoted_delivery->>'packageFormat'
    then raise exception 'Delivery measurements changed. Review again'; end if;
  if quoted_delivery ? 'parcels' then
    if jsonb_typeof(quoted_delivery->'parcels') is distinct from 'array'
      or jsonb_array_length(quoted_delivery->'parcels')<>jsonb_array_length(plan)
      or jsonb_array_length(plan) not between 2 and 20 then raise exception 'Delivery parcel plan changed. Review again'; end if;
    for parcel_index in 0..jsonb_array_length(plan)-1 loop
      quoted_parcel:=quoted_delivery->'parcels'->parcel_index;
      if jsonb_typeof(quoted_parcel) is distinct from 'object'
        or quoted_parcel-array['weightInGrams','quantity','carrierCostPence']<>'{}'::jsonb
        or (quoted_parcel->>'weightInGrams')::bigint is distinct from (plan->parcel_index->>'weightInGrams')::bigint
        or (quoted_parcel->>'quantity')::integer is distinct from (plan->parcel_index->>'quantity')::integer
        or coalesce((quoted_parcel->>'carrierCostPence')::bigint,-1) not between 0 and 99999999
        then raise exception 'Delivery parcel plan changed. Review again'; end if;
      parcel_cost:=parcel_cost+(quoted_parcel->>'carrierCostPence')::bigint;
    end loop;
    if parcel_cost is distinct from (quoted_delivery->>'carrierCostPence')::bigint then raise exception 'Delivery charges changed. Review again'; end if;
  elsif jsonb_array_length(plan)<>1 then raise exception 'Delivery parcel plan changed. Review again'; end if;
  if shipping_method='standard' then
    if quoted_delivery->>'serviceCode' is distinct from doc#>>'{shipping,standardServiceCode}' then raise exception 'Delivery service changed. Review again'; end if;
    shipping:=case when coalesce((doc#>>'{commerce,freeDeliveryEnabled}')::boolean,true) and subtotal>=threshold or coalesce((coupon_value->>'freeDelivery')::boolean,false) then 0 else (quoted_delivery->>'carrierCostPence')::bigint end;
  elsif shipping_method='express' and coalesce((doc#>>'{policies,delivery,expressAvailable}')::boolean,false) then
    if quoted_delivery->>'serviceCode' is distinct from doc#>>'{shipping,expressServiceCode}' then raise exception 'Delivery service changed. Review again'; end if;
    shipping:=(quoted_delivery->>'carrierCostPence')::bigint;
  else raise exception 'Delivery option is unavailable'; end if;
  if shipping is null or shipping not between 0 and 99999999
    or coalesce((quoted_delivery->>'carrierCostPence')::bigint,-1) not between 0 and 99999999
    or shipping is distinct from expected_delivery or shipping is distinct from (quoted_delivery->>'chargePence')::bigint
    then raise exception 'Delivery charges changed. Review again'; end if;
  else
    if quoted_delivery is not null or expected_shipping is not null then raise exception 'Delivery settings changed. Review again'; end if;
    if shipping_method='standard' then
      shipping:=case when coalesce((doc#>>'{commerce,freeDeliveryEnabled}')::boolean,true) and subtotal>=threshold
        or coalesce((coupon_value->>'freeDelivery')::boolean,false) then 0 else (doc#>>'{policies,delivery,standardChargePence}')::bigint end;
    elsif shipping_method='express' and coalesce((doc#>>'{policies,delivery,expressAvailable}')::boolean,false) then shipping:=(doc#>>'{policies,delivery,expressChargePence}')::bigint;
    else raise exception 'Delivery option is unavailable'; end if;
    if shipping is null or shipping not between 0 and 99999999 or shipping is distinct from expected_delivery then raise exception 'Delivery charges changed. Review again'; end if;
    quoted_delivery:=jsonb_build_object('id',shipping_method,'label',case when shipping_method='standard' then 'Standard delivery' else 'Express delivery' end,'carrier','Royal Mail','chargePence',shipping);
  end if;
  if subtotal-discount+shipping<30 then raise exception 'Discount code cannot be applied to this order total'; end if;
  number:=case when payment_mode='test' then 'SEEN-T-' else 'SEEN-' end||upper(substr(replace(target::text,'-',''),1,12));
  insert into seen_private.checkout_orders(id,request_id,owner_hash,request_hash,order_number,is_test,details,delivery,subtotal_pence,delivery_pence,total_pence,return_origin,discount_pence,coupon)
  values(target,request_id,owner_hash,request_hash,number,payment_mode='test',details,quoted_delivery,subtotal,shipping,subtotal-discount+shipping,return_origin,discount,coupon_value);
  insert into seen_private.checkout_coupon_uses(order_id,coupon_id,is_test) values(target,coupon_record,payment_mode='test');
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
    'subtotal_pence',subtotal,'delivery_pence',shipping,'total_pence',subtotal-discount+shipping,'currency','GBP','delivery_method',shipping_method,
    'payment_status','unpaid','status','pending','is_test',payment_mode='test','stock_state','reserved','tracking','','notes',''));
  perform seen_private.sync_checkout_order_record(target);
  return seen_private.payment_order_json(target);
end $$;


create or replace function public.admin_save_record(record_kind text, record_id uuid, data jsonb,expected_version integer default 0) returns uuid language plpgsql security definer set search_path = '' as $$
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
  if record_kind='coupon' and (coalesce(data->>'code','') !~ '^[A-Z0-9_-]{3,40}$' or coalesce(data->>'type','') not in ('percent','fixed','free_delivery') or coalesce((data->>'value')::integer,-1)<0 or (data->>'type'<>'free_delivery' and coalesce((data->>'value')::integer,0)<1) or (data->>'type'='percent' and (data->>'value')::integer>100)) then raise exception 'Invalid coupon'; end if;
  if record_kind='category' and current_row.id is not null and current_row.payload->>'slug' is distinct from data->>'slug' then update public.products set category=data->>'slug' where category=current_row.payload->>'slug'; end if;
  if current_row.id is null then insert into seen_private.admin_records(id,kind,payload) values(rid,record_kind,data);
  else update seen_private.admin_records set payload=data,version=version+1,updated_at=now() where id=rid; end if;
  perform seen_private.audit('save',record_kind,rid::text); return rid;
end $$;

revoke all on function public.admin_save_record(text,uuid,jsonb,integer) from public,anon,service_role;
grant execute on function public.admin_save_record(text,uuid,jsonb,integer) to authenticated;

-- One editable code, unlimited uses/no expiry initially. Preserve an existing owner's code edits on rerun.
insert into seen_private.admin_records(kind,payload)
select 'coupon',jsonb_build_object('code','FREEDEL','type','free_delivery','value',0,'min_subtotal_pence',0,'active',true,'expires_at',null,'usage_limit',null)
where not exists(select 1 from seen_private.admin_records where kind='coupon' and upper(payload->>'code')='FREEDEL');
revoke all on function public.checkout_coupon_attempt(text),public.checkout_coupon_quote(text,bigint,text),public.payment_prepare_order_v4(uuid,text,text,jsonb,jsonb,text,bigint,text,text,jsonb,jsonb,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.checkout_coupon_attempt(text),public.checkout_coupon_quote(text,bigint,text),public.payment_prepare_order_v4(uuid,text,text,jsonb,jsonb,text,bigint,text,text,jsonb,jsonb,jsonb,text,jsonb) to service_role;
revoke all on function seen_private.settle_checkout_coupon(),seen_private.protect_purchase_snapshot(),seen_private.sync_checkout_order_record(uuid),seen_private.queue_paid_order_emails() from public,anon,authenticated,service_role;
commit;
