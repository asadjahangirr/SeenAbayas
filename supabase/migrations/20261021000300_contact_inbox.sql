-- Inbox-only contact delivery, with shared limits and durable retry receipts.
-- Apply after the admin migration. Safe to rerun; existing messages, orders,
-- payments and stock are not modified by installation. No CAPTCHA is required.
begin;

create table if not exists seen_private.contact_ingress_guard (
  id integer primary key check (id=1)
);
insert into seen_private.contact_ingress_guard(id) values(1) on conflict do nothing;
create table if not exists seen_private.contact_receipts (
  request_id uuid primary key,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  sender_hash text not null check (sender_hash ~ '^[a-f0-9]{64}$'),
  network_hash text not null check (network_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists contact_receipts_sender_time on seen_private.contact_receipts(sender_hash,created_at);
create index if not exists contact_receipts_network_time on seen_private.contact_receipts(network_hash,created_at);
create index if not exists contact_receipts_time on seen_private.contact_receipts(created_at);
alter table seen_private.contact_ingress_guard enable row level security;
alter table seen_private.contact_receipts enable row level security;
revoke all on seen_private.contact_ingress_guard,seen_private.contact_receipts from public,anon,authenticated,service_role;

create or replace function public.submit_contact_enquiry(request_id uuid,message jsonb,network_hash text,sender_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare now_at timestamptz:=clock_timestamp(); digest text; previous seen_private.contact_receipts; submitted timestamptz;
begin
  if request_id is null or jsonb_typeof(message) is distinct from 'object'
    or coalesce(length(message->>'name'),0) not between 2 and 100
    or coalesce(length(message->>'email'),0) not between 3 and 254
    or coalesce(length(message->>'phone'),0) not between 7 and 40
    or coalesce(length(message->>'message'),0) not between 10 and 5000
    or coalesce(network_hash,'') !~ '^[a-f0-9]{64}$'
    or coalesce(sender_hash,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid enquiry';
  end if;
  begin submitted:=(message->>'submittedAt')::timestamptz;
  exception when others then raise exception 'Invalid enquiry'; end;
  if submitted is null or submitted<now_at-interval '23 hours' or submitted>now_at+interval '1 minute' then
    raise exception 'Invalid enquiry';
  end if;
  digest:=encode(sha256(convert_to(message::text,'UTF8')),'hex');

  -- One short row lock serialises the quota check and insertion, including
  -- requests from different serverless instances. Retries consume no quota.
  perform 1 from seen_private.contact_ingress_guard where id=1 for update;
  if not found then raise exception 'Contact inbox is unavailable'; end if;
  select * into previous from seen_private.contact_receipts r where r.request_id=submit_contact_enquiry.request_id;
  if found then
    if previous.fingerprint is distinct from digest then raise exception 'Contact reference changed'; end if;
    return jsonb_build_object('accepted',true,'duplicate',true);
  end if;
  if exists(select 1 from seen_private.admin_records r where r.id=request_id) then raise exception 'Contact reference changed'; end if;
  if (select count(*) from seen_private.contact_receipts r where r.created_at>now_at-interval '1 minute')>=30
    or (select count(*) from seen_private.contact_receipts r where r.sender_hash=submit_contact_enquiry.sender_hash and r.created_at>now_at-interval '15 minutes')>=3
    or (select count(*) from seen_private.contact_receipts r where r.network_hash=submit_contact_enquiry.network_hash and r.created_at>now_at-interval '15 minutes')>=6 then
    raise exception 'Contact rate limit exceeded';
  end if;
  insert into seen_private.admin_records(id,kind,payload) values(request_id,'message',jsonb_build_object(
    'name',message->>'name','email',message->>'email','phone',message->>'phone','message',message->>'message',
    'submitted_at',message->>'submittedAt','read',false,'archived',false,'notes',''));
  insert into seen_private.contact_receipts(request_id,fingerprint,sender_hash,network_hash)
    values(request_id,digest,sender_hash,network_hash);
  -- Receipts contain only HMAC identities and a payload digest, not addresses
  -- or message contents. Keep them through the accepted submission/retry age.
  delete from seen_private.contact_receipts where created_at<now_at-interval '24 hours';
  return jsonb_build_object('accepted',true,'duplicate',false);
end $$;
revoke all on function public.submit_contact_enquiry(uuid,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.submit_contact_enquiry(uuid,jsonb,text,text) to service_role;
commit;
