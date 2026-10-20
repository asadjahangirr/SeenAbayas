-- Order snapshots and a recoverable admin projection of verified checkout data.
-- Apply after 20261020000100_payments.sql. Test-only charging remains unchanged.
-- Rerunnable: refreshes existing order displays, never creates payments or edits stock.
begin;

alter table seen_private.checkout_orders add column if not exists payment_verified_at timestamptz;
alter table seen_private.checkout_orders add column if not exists confirmed_at timestamptz;
create unique index if not exists checkout_orders_payment_intent
  on seen_private.checkout_orders(payment_intent) where payment_intent is not null;

create or replace function seen_private.protect_purchase_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_table_name='checkout_items' then
    raise exception 'Purchase item snapshots cannot be changed';
  end if;
  if (new.request_id,new.owner_hash,new.request_hash,new.order_number,new.is_test,
      new.subtotal_pence,new.delivery_pence,new.total_pence,new.currency,new.delivery)
    is distinct from
     (old.request_id,old.owner_hash,old.request_hash,old.order_number,old.is_test,
      old.subtotal_pence,old.delivery_pence,old.total_pence,old.currency,old.delivery) then
    raise exception 'Purchase totals and identity cannot be changed';
  end if;
  if old.state='paid' and new.details is distinct from old.details then
    raise exception 'Confirmed customer details cannot be changed';
  end if;
  return new;
end $$;
drop trigger if exists protect_purchase_snapshot on seen_private.checkout_items;
create trigger protect_purchase_snapshot before update on seen_private.checkout_items
  for each row execute function seen_private.protect_purchase_snapshot();
drop trigger if exists protect_purchase_identity on seen_private.checkout_orders;
create trigger protect_purchase_identity before update on seen_private.checkout_orders
  for each row execute function seen_private.protect_purchase_snapshot();

-- Called only inside protected backend functions. Admin-editable JSON is never
-- payment authority. Preserve fulfilment notes while rebuilding purchase facts.
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
    'refunded_pence',o.refunded_pence,'currency','GBP','delivery_method',o.delivery->>'id',
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

create or replace function public.payment_apply_session(order_id uuid,event_id text,event_type text,session jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o seen_private.checkout_orders; item seen_private.checkout_items; next_state text; next_stock text; inserted integer;
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
    for item in select * from seen_private.checkout_items where checkout_items.order_id=o.id order by variant_id loop
      update seen_private.inventory set reserved=reserved-item.quantity,on_hand=on_hand-case when next_state='paid' and not o.is_test then item.quantity else 0 end
      where variant_id=item.variant_id and reserved>=item.quantity;
      if not found then raise exception 'Reservation needs attention'; end if;
    end loop;
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

create or replace function public.payment_health() returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ready',true,'test_only',true,'order_records_ready',true);
$$;

create or replace function seen_private.guard_payment_order_edit() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.kind='order' and new.payload->>'status'='confirmed' and
    (new.payload->>'payment_status' is distinct from 'paid' or coalesce((new.payload->>'needs_attention')::boolean,false)) then
    raise exception 'Payment must be verified by the payment provider';
  end if;
  if new.kind='order' and new.payload->>'status' in ('processing','shipped','completed') and
    (coalesce((new.payload->>'is_test')::boolean,false) or coalesce((new.payload->>'needs_attention')::boolean,false)) then
    raise exception 'Test or unresolved payment orders cannot be fulfilled';
  end if;
  if old.kind='order' and old.payload->>'stock_state'='reserved' and new.payload->>'status'='cancelled' and new.payload->>'stock_state'='reserved' then
    raise exception 'Cancel the Stripe checkout before releasing its reservation';
  end if;
  return new;
end $$;

-- Refresh pre-existing projections without inventing historical paid timestamps.
do $$ declare target uuid; begin
  for target in select id from seen_private.checkout_orders order by created_at loop
    perform seen_private.sync_checkout_order_record(target);
  end loop;
end $$;

revoke all on function seen_private.protect_purchase_snapshot(),seen_private.sync_checkout_order_record(uuid) from public,anon,authenticated,service_role;
revoke all on function public.payment_apply_session(uuid,text,text,jsonb),public.payment_health() from public,anon,authenticated;
grant execute on function public.payment_apply_session(uuid,text,text,jsonb),public.payment_health() to service_role;
commit;
