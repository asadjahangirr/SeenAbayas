-- Test-mode payment foundation. Adds private orders and protected server RPCs.
-- Does not create orders, alter stock, or activate payments when installed.
begin;

create table if not exists seen_private.checkout_orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  owner_hash text not null check(owner_hash ~ '^[a-f0-9]{64}$'),
  request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'),
  order_number text not null unique,
  is_test boolean not null check(is_test),
  state text not null default 'creating' check(state in ('creating','open','pending','paid','failed','expired','attention')),
  stock_state text not null default 'reserved' check(stock_state in ('reserved','released','committed','attention')),
  details jsonb not null check(jsonb_typeof(details)='object'),
  delivery jsonb not null check(jsonb_typeof(delivery)='object'),
  subtotal_pence bigint not null check(subtotal_pence>0),
  delivery_pence bigint not null check(delivery_pence>=0),
  total_pence bigint not null check(total_pence=subtotal_pence+delivery_pence),
  currency text not null default 'gbp' check(currency='gbp'),
  return_origin text not null,
  session_id text unique,
  checkout_url text,
  payment_intent text,
  refunded_pence bigint not null default 0 check(refunded_pence>=0 and refunded_pence<=total_pence),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default clock_timestamp()+interval '1 hour',
  updated_at timestamptz not null default clock_timestamp()
);
create table if not exists seen_private.checkout_items (
  order_id uuid not null references seen_private.checkout_orders(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check(quantity between 1 and 10),
  unit_price_pence integer not null check(unit_price_pence>0),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  primary key(order_id,variant_id)
);
create table if not exists seen_private.stripe_event_receipts (
  event_id text primary key check(length(event_id) between 1 and 250),
  order_id uuid not null references seen_private.checkout_orders(id) on delete restrict,
  event_type text not null,
  received_at timestamptz not null default clock_timestamp()
);
create index if not exists checkout_orders_pending on seen_private.checkout_orders(created_at) where stock_state='reserved';
alter table seen_private.checkout_orders add column if not exists last_checked_at timestamptz;
create index if not exists checkout_orders_owner on seen_private.checkout_orders(owner_hash,created_at);
create index if not exists checkout_items_variant on seen_private.checkout_items(variant_id);
alter table seen_private.checkout_orders enable row level security;
alter table seen_private.checkout_items enable row level security;
alter table seen_private.stripe_event_receipts enable row level security;
revoke all on seen_private.checkout_orders,seen_private.checkout_items,seen_private.stripe_event_receipts from public,anon,authenticated;

create or replace function seen_private.payment_order_json(target uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select to_jsonb(o)||jsonb_build_object('items',coalesce((select jsonb_agg(i.snapshot order by i.variant_id) from seen_private.checkout_items i where i.order_id=o.id),'[]'::jsonb))
  from seen_private.checkout_orders o where o.id=target;
$$;

create or replace function public.payment_health() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ready',true,'test_only',true);
$$;

create or replace function public.payment_get_order(order_id uuid, owner_hash text default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select seen_private.payment_order_json(o.id) from seen_private.checkout_orders o
  where o.id=payment_get_order.order_id and (payment_get_order.owner_hash is null or o.owner_hash=payment_get_order.owner_hash);
$$;

create or replace function public.payment_get_request(request_id uuid, owner_hash text, request_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing seen_private.checkout_orders;
begin
  select * into existing from seen_private.checkout_orders o where o.request_id=payment_get_request.request_id;
  if existing.id is null then return null; end if;
  if existing.owner_hash is distinct from owner_hash or existing.request_hash is distinct from request_hash then raise exception 'Checkout request does not match' using errcode='42501'; end if;
  return seen_private.payment_order_json(existing.id);
end $$;

create or replace function public.payment_prepare_order(request_id uuid,owner_hash text,request_hash text,details jsonb,requested_lines jsonb,shipping_method text,expected_delivery bigint,return_origin text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing jsonb; target uuid:=gen_random_uuid(); item jsonb; p public.products; v public.product_variants; inv seen_private.inventory;
  doc jsonb; subtotal bigint:=0; shipping bigint; threshold bigint; minimum bigint; snapshot jsonb; n integer; number text;
begin
  if request_id is null or owner_hash !~ '^[a-f0-9]{64}$' or request_hash !~ '^[a-f0-9]{64}$' or owner_hash is null or request_hash is null then raise exception 'Invalid checkout identity'; end if;
  perform pg_advisory_xact_lock(hashtext(owner_hash)::bigint);
  existing:=public.payment_get_request(request_id,owner_hash,request_hash);
  if existing is not null then return existing; end if;
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
  if (select count(*) from seen_private.checkout_orders o where o.owner_hash=payment_prepare_order.owner_hash and o.stock_state='reserved')>=3 then raise exception 'Finish or cancel an existing checkout before opening another'; end if;

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
  number:='SEEN-T-'||upper(substr(replace(target::text,'-',''),1,12));
  insert into seen_private.checkout_orders(id,request_id,owner_hash,request_hash,order_number,is_test,details,delivery,subtotal_pence,delivery_pence,total_pence,return_origin)
  values(target,request_id,owner_hash,request_hash,number,true,details,jsonb_build_object('id',shipping_method,'label',case when shipping_method='standard' then 'Standard delivery' else 'Express delivery' end,'carrier','Royal Mail','chargePence',shipping),subtotal,shipping,subtotal+shipping,return_origin);
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
    'payment_status','unpaid','status','pending','is_test',true,'stock_state','reserved','tracking','','notes',''));
  return seen_private.payment_order_json(target);
end $$;

create or replace function public.payment_apply_session(order_id uuid,event_id text,event_type text,session jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders; item seen_private.checkout_items; next_state text; next_stock text; next_payment text; next_status text; inserted integer;
begin
  select * into o from seen_private.checkout_orders where id=order_id for update;
  if o.id is null then raise exception 'Payment order not found'; end if;
  if session->>'order_id' is distinct from o.id::text or session->>'request_hash' is distinct from o.request_hash
    or (session->>'total_pence')::bigint is distinct from o.total_pence or session->>'currency' is distinct from o.currency
    or (session->>'is_test')::boolean is distinct from o.is_test or coalesce(session->>'id','') !~ '^cs_test_[A-Za-z0-9_]+$'
    or (o.session_id is not null and o.session_id is distinct from session->>'id') then raise exception 'Payment does not match the reserved order'; end if;
  next_state:=session->>'state';
  if next_state not in ('open','pending','paid','failed','expired') then raise exception 'Invalid payment state'; end if;
  insert into seen_private.stripe_event_receipts(event_id,order_id,event_type) values(event_id,o.id,event_type) on conflict do nothing;
  get diagnostics inserted=row_count;
  if inserted=0 then
    if not exists(select 1 from seen_private.stripe_event_receipts r where r.event_id=payment_apply_session.event_id and r.order_id=o.id) then raise exception 'Event belongs to a different order'; end if;
    return seen_private.payment_order_json(o.id);
  end if;
  if o.state in ('paid','attention') or (o.state in ('expired','failed') and next_state<>'paid') then return seen_private.payment_order_json(o.id); end if;
  next_stock:=o.stock_state;
  if next_state='paid' and coalesce((session->>'delivery_verified')::boolean,true)=false then next_state:='attention';
  elsif next_state='paid' and o.stock_state<>'reserved' then next_state:='attention'; next_stock:='attention';
  elsif next_state in ('paid','failed','expired') and o.stock_state='reserved' then
    for item in select * from seen_private.checkout_items where checkout_items.order_id=o.id order by variant_id loop
      -- Sandbox success releases its reservation without selling physical stock.
      update seen_private.inventory set reserved=reserved-item.quantity,on_hand=on_hand-case when next_state='paid' and not o.is_test then item.quantity else 0 end
      where variant_id=item.variant_id and reserved>=item.quantity;
      if not found then raise exception 'Reservation needs attention'; end if;
    end loop;
    next_stock:=case when next_state='paid' and not o.is_test then 'committed' else 'released' end;
  end if;
  next_payment:=case when next_state in ('paid','attention') then 'paid' when next_state in ('failed','expired') then next_state else 'unpaid' end;
  next_status:=case when next_state='paid' then 'confirmed' when next_state in ('failed','expired') then 'cancelled' else 'pending' end;
  update seen_private.checkout_orders set state=next_state,stock_state=next_stock,details=coalesce(session->'details',details),session_id=session->>'id',checkout_url=coalesce(nullif(session->>'checkout_url',''),checkout_url),payment_intent=coalesce(nullif(session->>'payment_intent',''),payment_intent),updated_at=clock_timestamp() where id=o.id;
  update seen_private.admin_records set payload=payload||jsonb_build_object('payment_status',next_payment,'status',next_status,'stock_state',next_stock,'needs_attention',next_state='attention','stripe_session_id',session->>'id','payment_intent',session->>'payment_intent')||case when session->'details' is not null then jsonb_build_object('address',session->'details','name',coalesce(session#>>'{details,recipientName}',concat(session#>>'{details,firstName}',' ',session#>>'{details,lastName}'))) else '{}'::jsonb end,version=version+1,updated_at=clock_timestamp() where id=o.id and kind='order';
  return seen_private.payment_order_json(o.id);
end $$;

create or replace function public.payment_pending_orders(batch_size integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate record; result jsonb:='[]'::jsonb;
begin
  -- Rotate the batch even when a provider is slow or an open session is unchanged.
  -- Attention cases require owner review and must not starve normal checkouts.
  for candidate in select id from seen_private.checkout_orders where stock_state='reserved' and state in ('creating','open','pending') order by coalesce(last_checked_at,created_at),id limit greatest(1,least(batch_size,10)) for update skip locked loop
    update seen_private.checkout_orders set last_checked_at=clock_timestamp() where id=candidate.id;
    result:=result||jsonb_build_array(seen_private.payment_order_json(candidate.id));
  end loop;
  return result;
end;
$$;

-- Release an orphan only after the server has exhaustively checked Stripe's
-- session list and the frozen session-creation window has passed.
create or replace function public.payment_release_orphan(order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders; item seen_private.checkout_items;
begin
  select * into o from seen_private.checkout_orders where id=order_id for update;
  if o.id is null or o.state<>'creating' or o.session_id is not null or o.stock_state<>'reserved' or o.expires_at>clock_timestamp()-interval '10 minutes' then raise exception 'Orphan is not eligible for release'; end if;
  for item in select * from seen_private.checkout_items where checkout_items.order_id=o.id order by variant_id loop
    update seen_private.inventory set reserved=reserved-item.quantity where variant_id=item.variant_id and reserved>=item.quantity;
    if not found then raise exception 'Reservation needs attention'; end if;
  end loop;
  update seen_private.checkout_orders set state='failed',stock_state='released',updated_at=clock_timestamp() where id=o.id;
  update seen_private.admin_records set payload=payload||'{"payment_status":"failed","status":"cancelled","stock_state":"released"}'::jsonb,version=version+1,updated_at=clock_timestamp() where id=o.id;
end $$;

-- Prevent fulfilment of sandbox orders or unresolved reservation problems,
-- including direct RPC calls outside the admin UI.
create or replace function seen_private.guard_payment_order_edit() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.kind='order' and new.payload->>'status' in ('processing','shipped','completed') and
    (coalesce((new.payload->>'is_test')::boolean,false) or coalesce((new.payload->>'needs_attention')::boolean,false)) then raise exception 'Test or unresolved payment orders cannot be fulfilled'; end if;
  if old.kind='order' and old.payload->>'stock_state'='reserved' and new.payload->>'status'='cancelled' and new.payload->>'stock_state'='reserved' then raise exception 'Cancel the Stripe checkout before releasing its reservation'; end if;
  return new;
end $$;
drop trigger if exists protect_payment_orders on seen_private.admin_records;
create trigger protect_payment_orders before update on seen_private.admin_records for each row execute function seen_private.guard_payment_order_edit();

-- Keep existing records and admin contracts; only exclude labelled sandbox
-- transactions from commercial totals/counts.
create or replace function public.admin_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  perform seen_private.require_admin();
  select jsonb_build_object(
    'site',(select to_jsonb(s) from seen_private.site_documents s where id),
    'products',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('variants',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('on_hand',coalesce(i.on_hand,0),'reserved',coalesce(i.reserved,0),'inventory_known',i.variant_id is not null) order by v.sort_order) from public.product_variants v left join seen_private.inventory i on i.variant_id=v.id where v.product_id=p.id),'[]'::jsonb)) order by p.sort_order) from public.products p),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(to_jsonb(r)) from (select * from seen_private.admin_records where public.is_seen_admin(true) or kind='category' order by created_at desc limit 1000) r),'[]'::jsonb),
    'statistics',case when public.is_seen_admin(true) then jsonb_build_object(
      'recordCount',(select count(*) from seen_private.admin_records),
      'orderCount',(select count(*) from seen_private.admin_records where kind='order' and coalesce(payload->>'is_test','false')<>'true'),
      'paidPence',(select coalesce(sum(case when jsonb_typeof(payload->'total_pence')='number' then (payload->>'total_pence')::numeric else 0 end-case when jsonb_typeof(payload->'refunded_pence')='number' then (payload->>'refunded_pence')::numeric else 0 end),0) from seen_private.admin_records where kind='order' and payload->>'payment_status'='paid' and coalesce(payload->>'is_test','false')<>'true'),
      'expensePence',(select coalesce(sum((payload->>'amount_pence')::numeric),0) from seen_private.admin_records where kind='expense')
    ) else null end,
    'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select * from seen_private.admin_audit order by id desc limit 100) a),'[]'::jsonb),
    'history',coalesce((select jsonb_agg(jsonb_build_object('version',h.version,'created_at',h.created_at) order by version desc) from seen_private.site_history h),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function seen_private.payment_order_json(uuid),seen_private.guard_payment_order_edit() from public,anon,authenticated;
revoke all on function public.payment_health(),public.payment_get_order(uuid,text),public.payment_get_request(uuid,text,text),public.payment_prepare_order(uuid,text,text,jsonb,jsonb,text,bigint,text),public.payment_apply_session(uuid,text,text,jsonb),public.payment_pending_orders(integer),public.payment_release_orphan(uuid) from public,anon,authenticated;
grant execute on function public.payment_health(),public.payment_get_order(uuid,text),public.payment_get_request(uuid,text,text),public.payment_prepare_order(uuid,text,text,jsonb,jsonb,text,bigint,text),public.payment_apply_session(uuid,text,text,jsonb),public.payment_pending_orders(integer),public.payment_release_orphan(uuid) to service_role;
commit;
