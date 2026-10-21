-- Durable paid-order email queue. Apply after 20261021000100_live_payments.sql.
-- Rerunnable. No historic email backfill, payments, stock edits or email sends.
begin;

create table if not exists seen_private.order_emails (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references seen_private.checkout_orders(id),
  kind text not null check(kind in ('customer_confirmation','owner_notification')),
  snapshot jsonb not null,
  state text not null default 'queued' check(state in ('queued','sending','accepted','review','suppressed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default clock_timestamp(),
  claim_token uuid,
  lease_until timestamptz,
  first_attempt_at timestamptz,
  message jsonb,
  provider_id text,
  last_error text check(last_error in ('provider_unavailable','provider_rejected','invalid_snapshot','retry_window_elapsed','test_suppressed')),
  accepted_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(order_id,kind)
);
alter table seen_private.order_emails enable row level security;
revoke all on seen_private.order_emails from public,anon,authenticated,service_role;
create index if not exists order_emails_due on seen_private.order_emails(next_attempt_at,created_at)
  where state in ('queued','sending');

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
    'subtotal_pence',new.subtotal_pence,'delivery_pence',new.delivery_pence,
    'tax_pence',new.tax_pence,'total_pence',new.total_pence,
    'confirmed_at',new.confirmed_at,
    'items',(select jsonb_agg(i.snapshot order by i.variant_id) from seen_private.checkout_items i where i.order_id=new.id)
  ) into purchase;
  insert into seen_private.order_emails(order_id,kind,snapshot)
  values(new.id,'customer_confirmation',purchase),(new.id,'owner_notification',purchase)
  on conflict(order_id,kind) do nothing;
  return new;
end $$;
drop trigger if exists queue_paid_order_emails on seen_private.checkout_orders;
create trigger queue_paid_order_emails after update of state on seen_private.checkout_orders
  for each row execute function seen_private.queue_paid_order_emails();
revoke all on function seen_private.queue_paid_order_emails() from public,anon,authenticated,service_role;

create or replace function public.order_email_claim(target_order uuid default null,batch_size integer default 2,payment_mode text default 'live')
returns jsonb language plpgsql security definer set search_path='' as $$
declare entry seen_private.order_emails; claimed jsonb:='[]'::jsonb;
begin
  if payment_mode is null or payment_mode not in ('test','live') then raise exception 'Invalid email environment'; end if;
  for entry in select * from seen_private.order_emails e
    where e.state in ('queued','sending') and e.next_attempt_at<=clock_timestamp()
      and (e.lease_until is null or e.lease_until<clock_timestamp())
      and (target_order is null or e.order_id=target_order)
      and (e.snapshot->>'is_test')::boolean=(payment_mode='test')
    order by e.next_attempt_at,e.created_at,e.id
    limit greatest(1,least(coalesce(batch_size,2),10)) for update skip locked
  loop
    -- Resend retains idempotency keys for 24h. Never automatically resend an
    -- ambiguous request after that window; an owner must inspect provider logs.
    if entry.first_attempt_at is not null and entry.first_attempt_at<clock_timestamp()-interval '23 hours' then
      update seen_private.order_emails set state='review',last_error='retry_window_elapsed',claim_token=null,lease_until=null where id=entry.id;
      continue;
    end if;
    update seen_private.order_emails set state='sending',attempts=attempts+1,
      claim_token=gen_random_uuid(),lease_until=clock_timestamp()+interval '2 minutes'
      where id=entry.id returning * into entry;
    claimed:=claimed||jsonb_build_array(jsonb_build_object('id',entry.id,'kind',entry.kind,
      'claim_token',entry.claim_token,'snapshot',entry.snapshot,'message',entry.message));
  end loop;
  return claimed;
end $$;

-- Freeze the complete provider request before the network call. Retries retain
-- the same recipient, sender, content and idempotency key after a deployment.
create or replace function public.order_email_freeze(email_id uuid,claim uuid,message jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare entry seen_private.order_emails;
begin
  select * into entry from seen_private.order_emails where id=email_id for update;
  if entry.id is null or entry.state<>'sending' or entry.claim_token is distinct from claim or entry.lease_until<clock_timestamp() then raise exception 'Email lease is unavailable'; end if;
  if entry.first_attempt_at is not null and entry.first_attempt_at<clock_timestamp()-interval '23 hours' then raise exception 'Email retry window expired'; end if;
  if entry.message is null then
    if message is null or jsonb_typeof(message)<>'object' or octet_length(message::text)>200000
      or jsonb_typeof(message->'to') is distinct from 'array' or jsonb_array_length(message->'to')<>1
      or coalesce(length(message->>'from'),0)=0 or coalesce(length(message->>'html'),0)=0
      or coalesce(length(message->>'text'),0)=0 then raise exception 'Invalid email message'; end if;
    update seen_private.order_emails e set message=order_email_freeze.message,
      first_attempt_at=coalesce(e.first_attempt_at,clock_timestamp()) where e.id=email_id returning * into entry;
  end if;
  return entry.message;
end $$;

create or replace function public.order_email_finish(email_id uuid,claim uuid,outcome text,provider_id text default null)
returns boolean language plpgsql security definer set search_path='' as $$
declare entry seen_private.order_emails; next_state text; code text;
begin
  select * into entry from seen_private.order_emails where id=email_id for update;
  if entry.id is null or entry.state<>'sending' or entry.claim_token is distinct from claim then return false; end if;
  if outcome='accepted' and coalesce(length(provider_id),0) between 1 and 100 and entry.message is not null then
    next_state:='accepted'; code:=null;
  elsif outcome='retry' then next_state:='queued'; code:='provider_unavailable';
  elsif outcome='rejected' then next_state:='review'; code:='provider_rejected';
  elsif outcome='invalid' then next_state:='review'; code:='invalid_snapshot';
  elsif outcome='suppressed' and (entry.snapshot->>'is_test')::boolean then next_state:='suppressed'; code:='test_suppressed';
  else raise exception 'Invalid email outcome'; end if;
  update seen_private.order_emails e set state=next_state,last_error=code,
    provider_id=case when next_state='accepted' then order_email_finish.provider_id else e.provider_id end,
    accepted_at=case when next_state='accepted' then clock_timestamp() else e.accepted_at end,
    next_attempt_at=clock_timestamp()+make_interval(secs=>least(3600,30*power(2,least(e.attempts,7)))::integer),
    claim_token=null,lease_until=null where e.id=email_id;
  return true;
end $$;

-- Owner server routes expose statuses only, never raw snapshots or messages.
create or replace function public.order_email_status(target_order uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('ready',true,
    'counts',(select coalesce(jsonb_object_agg(state,n),'{}'::jsonb) from
      (select state,count(*) n from seen_private.order_emails where target_order is null or order_id=target_order group by state) c),
    'messages',case when target_order is null then '[]'::jsonb else
      (select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'state',state,'attempts',attempts,
        'acceptedAt',accepted_at,'error',last_error) order by kind),'[]'::jsonb)
      from seen_private.order_emails where order_id=target_order) end);
$$;

revoke all on function public.order_email_claim(uuid,integer,text),public.order_email_freeze(uuid,uuid,jsonb),
  public.order_email_finish(uuid,uuid,text,text),public.order_email_status(uuid) from public,anon,authenticated;
grant execute on function public.order_email_claim(uuid,integer,text),public.order_email_freeze(uuid,uuid,jsonb),
  public.order_email_finish(uuid,uuid,text,text),public.order_email_status(uuid) to service_role;
commit;
