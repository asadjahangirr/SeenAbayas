-- Apply after order_records. Installs stock safeguards/recovery support only.
-- No existing quantities, reservations, orders or payment modes are changed.
begin;

create table if not exists seen_private.checkout_stock_events (
  order_id uuid not null references seen_private.checkout_orders(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  movement text not null check(movement in ('reserved','released','committed')),
  quantity integer not null check(quantity between 1 and 10),
  on_hand_delta integer not null,
  occurred_at timestamptz not null default clock_timestamp(),
  primary key(order_id,variant_id,movement),
  check(on_hand_delta=case when movement='committed' then -quantity else 0 end)
);
alter table seen_private.checkout_stock_events enable row level security;
revoke all on seen_private.checkout_stock_events from public,anon,authenticated,service_role;

create or replace function seen_private.record_stock_reservation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into seen_private.checkout_stock_events(order_id,variant_id,movement,quantity,on_hand_delta)
  values(new.order_id,new.variant_id,'reserved',new.quantity,0);
  return new;
end $$;
drop trigger if exists record_stock_reservation on seen_private.checkout_items;
create trigger record_stock_reservation after insert on seen_private.checkout_items
  for each row execute function seen_private.record_stock_reservation();

-- All terminal reservation movements use this trigger, in the order update's
-- transaction. Lock parent products before inventory, like admin/checkout writes.
-- Updating inventory also touches its parent product; reversing that lock order
-- can deadlock a simultaneous checkout or stock edit.
create or replace function seen_private.settle_checkout_stock() returns trigger
language plpgsql security definer set search_path='' as $$
declare item seen_private.checkout_items;
begin
  if new.stock_state is not distinct from old.stock_state then return new; end if;
  if old.stock_state<>'reserved' then
    if old.stock_state='released' and new.stock_state='attention' and new.state='attention' then return new; end if;
    raise exception 'Settled stock cannot be reserved or deducted again';
  end if;
  if new.stock_state not in ('released','committed')
    or (new.stock_state='committed' and (new.is_test or new.state<>'paid'))
    or (new.stock_state='released' and not(new.state in ('failed','expired') or (new.state='paid' and new.is_test))) then
    raise exception 'Invalid checkout stock transition';
  end if;
  if not exists(select 1 from seen_private.checkout_items where order_id=old.id) then
    raise exception 'Reservation has no purchase items';
  end if;
  perform 1 from public.products p where p.id in
    (select i.product_id from seen_private.checkout_items i where i.order_id=old.id)
    order by p.id for update;
  for item in select * from seen_private.checkout_items where order_id=old.id order by variant_id loop
    update seen_private.inventory set reserved=reserved-item.quantity,
      on_hand=on_hand-case when new.stock_state='committed' then item.quantity else 0 end
      where variant_id=item.variant_id and reserved>=item.quantity;
    if not found then raise exception 'Reservation needs attention'; end if;
    insert into seen_private.checkout_stock_events(order_id,variant_id,movement,quantity,on_hand_delta)
    values(old.id,item.variant_id,new.stock_state,item.quantity,case when new.stock_state='committed' then -item.quantity else 0 end);
  end loop;
  return new;
end $$;
drop trigger if exists settle_checkout_stock on seen_private.checkout_orders;
create trigger settle_checkout_stock before update of stock_state on seen_private.checkout_orders
  for each row execute function seen_private.settle_checkout_stock();

create or replace function public.payment_release_orphan(order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders;
begin
  select * into o from seen_private.checkout_orders where id=order_id for update;
  if o.id is null or o.state<>'creating' or o.session_id is not null or o.stock_state<>'reserved'
    or o.expires_at>clock_timestamp()-interval '10 minutes' then raise exception 'Orphan is not eligible for release'; end if;
  update seen_private.checkout_orders set state='failed',stock_state='released',updated_at=clock_timestamp() where id=o.id;
  perform seen_private.sync_checkout_order_record(o.id);
end $$;

-- Claim a bounded rotating batch for two minutes. Concurrent workers do not
-- immediately repeat the same provider lookup; crashed workers recover later.
alter table seen_private.checkout_orders add column if not exists recovery_lease_until timestamptz;
create or replace function public.payment_pending_orders(batch_size integer default 5) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate record; result jsonb:='[]'::jsonb;
begin
  for candidate in select id from seen_private.checkout_orders
    where stock_state='reserved' and state in ('creating','open','pending')
      and (recovery_lease_until is null or recovery_lease_until<clock_timestamp())
    order by coalesce(last_checked_at,created_at),id
    limit greatest(1,least(coalesce(batch_size,5),10)) for update skip locked loop
    update seen_private.checkout_orders set last_checked_at=clock_timestamp(),
      recovery_lease_until=clock_timestamp()+interval '2 minutes' where id=candidate.id;
    result:=result||jsonb_build_array(seen_private.payment_order_json(candidate.id));
  end loop;
  return result;
end $$;

create or replace function public.payment_health() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ready',true,'test_only',true,'order_records_ready',true,'stock_management_ready',true);
$$;

revoke all on function seen_private.record_stock_reservation(),seen_private.settle_checkout_stock() from public,anon,authenticated,service_role;
revoke all on function public.payment_release_orphan(uuid),public.payment_pending_orders(integer),public.payment_health() from public,anon,authenticated;
grant execute on function public.payment_release_orphan(uuid),public.payment_pending_orders(integer),public.payment_health() to service_role;

-- payment_apply_session is replaced below to let the single stock trigger make
-- the movement atomically. The verification/idempotency/order projection stay.

create or replace function public.payment_apply_session(order_id uuid,event_id text,event_type text,session jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders; next_state text; next_stock text; inserted integer;
begin
  select * into o from seen_private.checkout_orders where id=order_id for update;
  if o.id is null then raise exception 'Payment order not found'; end if;
  if session->>'order_id' is distinct from o.id::text or session->>'request_hash' is distinct from o.request_hash
    or (session->>'total_pence')::bigint is distinct from o.total_pence or session->>'currency' is distinct from o.currency
    or (session->>'is_test')::boolean is distinct from o.is_test or coalesce(session->>'id','') !~ '^cs_test_[A-Za-z0-9_]+$'
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


commit;
