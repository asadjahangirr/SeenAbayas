-- Live payment capability. Apply after 20261020000300_stock_management.sql.
-- Adds support only: does not create charges, edit stock or rewrite test orders.
-- Application live activation requires matching live keys and PAYMENTS_MODE=live.
begin;
alter table seen_private.checkout_orders drop constraint if exists checkout_orders_is_test_check;
alter table seen_private.checkout_orders add column if not exists tax_pence bigint not null default 0 check(tax_pence=0);

create or replace function public.payment_prepare_order_v2(request_id uuid,owner_hash text,request_hash text,details jsonb,requested_lines jsonb,shipping_method text,expected_delivery bigint,return_origin text,payment_mode text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; target uuid:=gen_random_uuid(); item jsonb; p public.products; v public.product_variants; inv seen_private.inventory;
  doc jsonb; subtotal bigint:=0; shipping bigint; threshold bigint; minimum bigint; snapshot jsonb; n integer; number text;
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
  if (select count(*) from seen_private.checkout_orders o where o.owner_hash=payment_prepare_order_v2.owner_hash and o.stock_state='reserved')>=3 then raise exception 'Finish or cancel an existing checkout before opening another'; end if;

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
  end loop;
  threshold:=coalesce((doc#>>'{commerce,freeDeliveryThresholdPence}')::bigint,8000);
  minimum:=coalesce((doc#>>'{commerce,minimumOrderPence}')::bigint,0);
  if subtotal<minimum then raise exception 'Selection is below the minimum order value'; end if;
  if shipping_method='standard' then
    shipping:=case when coalesce((doc#>>'{commerce,freeDeliveryEnabled}')::boolean,true) and subtotal>=threshold then 0 else (doc#>>'{policies,delivery,standardChargePence}')::bigint end;
  elsif shipping_method='express' and coalesce((doc#>>'{policies,delivery,expressAvailable}')::boolean,false) then shipping:=(doc#>>'{policies,delivery,expressChargePence}')::bigint;
  else raise exception 'Delivery option is unavailable'; end if;
  if shipping is null or shipping<0 or shipping>99999999 then raise exception 'Delivery charge is not configured'; end if;
  if shipping is distinct from expected_delivery then raise exception 'Delivery charges changed. Review your selection again'; end if;
  number:=case when payment_mode='test' then 'SEEN-T-' else 'SEEN-' end||upper(substr(replace(target::text,'-',''),1,12));
  insert into seen_private.checkout_orders(id,request_id,owner_hash,request_hash,order_number,is_test,details,delivery,subtotal_pence,delivery_pence,total_pence,return_origin)
  values(target,request_id,owner_hash,request_hash,number,payment_mode='test',details,jsonb_build_object('id',shipping_method,'label',case when shipping_method='standard' then 'Standard delivery' else 'Express delivery' end,'carrier','Royal Mail','chargePence',shipping),subtotal,shipping,subtotal+shipping,return_origin);
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
  return seen_private.payment_order_json(target);
end $$;


create or replace function public.payment_apply_session(order_id uuid,event_id text,event_type text,session jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders; next_state text; next_stock text; inserted integer;
begin
  select * into o from seen_private.checkout_orders where id=order_id for update;
  if o.id is null then raise exception 'Payment order not found'; end if;
  if session->>'order_id' is distinct from o.id::text or session->>'request_hash' is distinct from o.request_hash
    or (session->>'total_pence')::bigint is distinct from o.total_pence or session->>'currency' is distinct from o.currency
    or (session->>'is_test')::boolean is distinct from o.is_test or coalesce(session->>'id','') !~ (case when o.is_test then '^cs_test_[A-Za-z0-9_]+$' else '^cs_live_[A-Za-z0-9_]+$' end)
    or (o.session_id is not null and o.session_id is distinct from session->>'id') then raise exception 'Payment does not match the reserved order'; end if;
  next_state:=session->>'state';
  if next_state not in ('open','pending','paid','failed','expired') then raise exception 'Invalid payment state'; end if;
  if next_state='paid' and coalesce(session->>'payment_intent','') !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception 'Paid checkout requires a verified payment reference';
  end if;
  insert into seen_private.stripe_event_receipts(event_id,order_id,event_type) values(event_id,o.id,event_type) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then
    if not exists(select 1 from seen_private.stripe_event_receipts r where r.event_id=payment_apply_session.event_id and r.order_id=o.id) then raise exception 'Event belongs to a different order'; end if;
    perform seen_private.sync_checkout_order_record(o.id);
    return seen_private.payment_order_json(o.id);
  end if;
  if o.state in ('paid','attention') or (o.state in ('expired','failed') and next_state<>'paid') then
    perform seen_private.sync_checkout_order_record(o.id);
    return seen_private.payment_order_json(o.id);
  end if;
  next_stock:=o.stock_state;
  if next_state='paid' and coalesce((session->>'delivery_verified')::boolean,true)=false then next_state:='attention';
  elsif next_state='paid' and o.stock_state<>'reserved' then next_state:='attention'; next_stock:='attention';
  elsif next_state in ('paid','failed','expired') and o.stock_state='reserved' then
    next_stock:=case when next_state='paid' and not o.is_test then 'committed' else 'released' end;
  end if;
  update seen_private.checkout_orders set state=next_state,stock_state=next_stock,
    details=coalesce(session->'details',details),session_id=session->>'id',
    checkout_url=coalesce(nullif(session->>'checkout_url',''),checkout_url),
    payment_intent=coalesce(nullif(session->>'payment_intent',''),payment_intent),
    payment_verified_at=case when next_state in ('paid','attention') then coalesce(payment_verified_at,clock_timestamp()) else payment_verified_at end,
    confirmed_at=case when next_state='paid' then coalesce(confirmed_at,clock_timestamp()) else confirmed_at end,
    updated_at=clock_timestamp() where id=o.id;
  perform seen_private.sync_checkout_order_record(o.id);
  if next_state='paid' then
    insert into seen_private.admin_audit(action,entity,entity_id) values('payment_confirmed','order',o.id::text);
  elsif next_state='attention' then
    insert into seen_private.admin_audit(action,entity,entity_id) values('payment_needs_review','order',o.id::text);
  end if;
  return seen_private.payment_order_json(o.id);
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
    'subtotal_pence',o.subtotal_pence,'delivery_pence',o.delivery_pence,'total_pence',o.total_pence,
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


create or replace function public.payment_health() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ready',true,'test_only',false,'test_supported',true,'order_records_ready',true,'stock_management_ready',true,'live_payments_ready',true,'tax_mode','none');
$$;
revoke all on function public.payment_prepare_order_v2(uuid,text,text,jsonb,jsonb,text,bigint,text,text) from public,anon,authenticated;
grant execute on function public.payment_prepare_order_v2(uuid,text,text,jsonb,jsonb,text,bigint,text,text) to service_role;
commit;
