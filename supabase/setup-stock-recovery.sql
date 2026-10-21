-- OPERATOR SETUP, separate from migrations. Run only after deploying point 4.
-- Enable pg_cron, pg_net and pgcrypto first. Add both Vault entries described in
-- docs/STOCK_SETUP.md privately; no credentials belong in this checked-in file.
begin;
-- BEGIN platform prerequisite checks (Supabase-owned extensions).
do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
    or not exists(select 1 from pg_extension where extname='pg_net')
    or to_regprocedure('extensions.hmac(bytea,bytea,text)') is null
    or to_regclass('cron.job') is null
    or to_regclass('net._http_response') is null then
    raise exception 'Enable pg_cron, pg_net and pgcrypto (extensions schema) first';
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise exception 'Supabase Vault is not available in this project';
  end if;
  if to_regnamespace('seen_private') is null
    or to_regprocedure('public.payment_health()') is null then
    raise exception 'Install the existing payment and stock migrations first';
  end if;
end $$;
-- END platform prerequisite checks.

-- Validate once here and again on every scheduled run. Never log secret values.
create or replace function seen_private.stock_recovery_configuration()
returns table(endpoint text,signing_token text)
language plpgsql security definer set search_path='' as $$
declare token_count bigint; url_count bigint; token_value text; url_value text;
begin
  select count(*) into token_count from vault.decrypted_secrets where name='seen_stock_recovery_token';
  select count(*) into url_count from vault.decrypted_secrets where name='seen_stock_recovery_url';
  if token_count<>1 then
    raise exception 'Vault entry seen_stock_recovery_token is missing or duplicated'
      using hint='Use this exact secret NAME in the existing project Vault; do not put it only in Description.';
  end if;
  if url_count<>1 then
    raise exception 'Vault entry seen_stock_recovery_url is missing or duplicated'
      using hint='Use this exact secret NAME in the existing project Vault.';
  end if;
  select decrypted_secret into token_value from vault.decrypted_secrets where name='seen_stock_recovery_token';
  select decrypted_secret into url_value from vault.decrypted_secrets where name='seen_stock_recovery_url';
  if token_value is null or length(token_value) not between 32 and 256 then
    raise exception 'Vault entry seen_stock_recovery_token must contain the actual 32-256 character recovery token'
      using hint='Copy the exact PAYMENTS_RECONCILE_SECRET value from your private Vercel setting; CONFIGURED is only a status, not the token.';
  end if;
  -- The signing token is never trimmed or changed; its bytes must match Vercel.
  -- Only the public endpoint tolerates clipboard whitespace/a trailing slash.
  endpoint:=rtrim(btrim(url_value,E' \t\n\r'),'/');
  if endpoint is null or endpoint !~ '^https://[A-Za-z0-9.-]+/api/payments/reconcile$' then
    raise exception 'Vault entry seen_stock_recovery_url is not a valid recovery endpoint'
      using hint='Use https://www.seenabayas.co.uk/api/payments/reconcile as the secret VALUE, without quotes, Markdown, a query or fragment.';
  end if;
  signing_token:=token_value;
  return next;
end $$;
revoke all on function seen_private.stock_recovery_configuration() from public,anon,authenticated,service_role;

-- Failure rolls back the complete setup without changing any commerce records.
do $$ begin perform 1 from seen_private.stock_recovery_configuration(); end $$;

create table if not exists seen_private.stock_recovery_requests (
  request_id bigint primary key,created_at timestamptz not null default clock_timestamp()
);
alter table seen_private.stock_recovery_requests enable row level security;
revoke all on seen_private.stock_recovery_requests from public,anon,authenticated,service_role;

create or replace function seen_private.enqueue_stock_recovery() returns bigint
language plpgsql security definer set search_path='' as $$
declare target text; token text; stamp text; proof text; request_id bigint;
begin
  select endpoint,signing_token into strict target,token from seen_private.stock_recovery_configuration();
  stamp:=floor(extract(epoch from clock_timestamp()))::bigint::text;
  proof:=encode(extensions.hmac(
    convert_to('seen-stock-recovery:v1:'||stamp||':POST:/api/payments/reconcile','UTF8'),
    convert_to(token,'UTF8'),'sha256'),'hex');
  select net.http_post(url:=target,
    headers:=jsonb_build_object('Content-Type','application/json',
      'x-seen-recovery-timestamp',stamp,'x-seen-recovery-signature',proof),
    body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;
  insert into seen_private.stock_recovery_requests(request_id) values(request_id);
  delete from seen_private.stock_recovery_requests where created_at<clock_timestamp()-interval '7 days';
  return request_id;
end $$;
revoke all on function seen_private.enqueue_stock_recovery() from public,anon,authenticated,service_role;

-- A named schedule is replaced rather than duplicated on rerun.
do $$ begin
  perform cron.schedule('seen-stock-recovery','* * * * *','select seen_private.enqueue_stock_recovery();');
end $$;
commit;

-- Explicit status on success; no credentials are selected.
select jobname,schedule,active,
  to_regclass('seen_private.stock_recovery_requests') is not null as request_table_ready
from cron.job where jobname='seen-stock-recovery';

-- Observe HTTP outcomes, not just the successful SQL enqueue in Cron history:
-- select r.created_at,h.status_code,h.timed_out,h.error_msg,
--        h.content as response
-- from seen_private.stock_recovery_requests r
-- left join net._http_response h on h.id=r.request_id
-- order by r.created_at desc limit 10;
-- A NULL status is still queued, or its short-lived pg_net response expired.
-- Stop the job with: select cron.unschedule('seen-stock-recovery');
