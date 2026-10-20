-- OPERATOR SETUP, separate from migrations. Run only after deploying point 4.
-- Enable pg_cron, pg_net and pgcrypto first. Add both Vault entries described in
-- docs/STOCK_SETUP.md privately; no credentials belong in this checked-in file.
begin;
do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
    or not exists(select 1 from pg_extension where extname='pg_net')
    or to_regprocedure('extensions.hmac(bytea,bytea,text)') is null then
    raise exception 'Enable pg_cron, pg_net and pgcrypto (extensions schema) first';
  end if;
  if not exists(select 1 from vault.decrypted_secrets where name='seen_stock_recovery_token' and length(decrypted_secret) between 32 and 256)
    or not exists(select 1 from vault.decrypted_secrets where name='seen_stock_recovery_url'
      and decrypted_secret ~ '^https://[A-Za-z0-9.-]+/api/payments/reconcile$') then
    raise exception 'Configure the two stock recovery Vault entries first';
  end if;
end $$;

create table if not exists seen_private.stock_recovery_requests (
  request_id bigint primary key,created_at timestamptz not null default clock_timestamp()
);
alter table seen_private.stock_recovery_requests enable row level security;
revoke all on seen_private.stock_recovery_requests from public,anon,authenticated,service_role;

create or replace function seen_private.enqueue_stock_recovery() returns bigint
language plpgsql security definer set search_path='' as $$
declare target text; token text; stamp text; proof text; request_id bigint;
begin
  select decrypted_secret into strict target from vault.decrypted_secrets where name='seen_stock_recovery_url';
  select decrypted_secret into strict token from vault.decrypted_secrets where name='seen_stock_recovery_token';
  if target !~ '^https://[A-Za-z0-9.-]+/api/payments/reconcile$' or length(token) not between 32 and 256 then
    raise exception 'Stock recovery configuration is invalid';
  end if;
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
select cron.schedule('seen-stock-recovery','* * * * *','select seen_private.enqueue_stock_recovery();');
commit;

-- Observe HTTP outcomes, not just the successful SQL enqueue in Cron history:
-- select r.created_at,h.status_code,h.timed_out,h.error_msg,
--        h.content as response
-- from seen_private.stock_recovery_requests r
-- left join net._http_response h on h.id=r.request_id
-- order by r.created_at desc limit 10;
-- A NULL status is still queued, or its short-lived pg_net response expired.
-- Stop the job with: select cron.unschedule('seen-stock-recovery');
