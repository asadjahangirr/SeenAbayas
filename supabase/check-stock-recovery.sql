-- Read-only operator check. Run in the existing Supabase SQL Editor after the
-- active job has had 1-2 minutes to execute. Does not invoke recovery or edit stock.
-- No request headers, Vault values, order details or customer data are selected.
-- Avoid 42P01 after a rolled-back setup: explain which script must succeed.
do $$ begin
  if to_regclass('seen_private.stock_recovery_requests') is null
    or to_regclass('cron.job') is null
    or to_regclass('net._http_response') is null then
    raise exception 'Stock recovery setup is incomplete; run the corrected supabase/setup-stock-recovery.sql first'
      using hint='A failed setup creates no request table or job. Resolve its specific Vault/prerequisite error; do not reset inventory.';
  end if;
  if not exists(select 1 from cron.job where jobname='seen-stock-recovery') then
    raise exception 'The seen-stock-recovery Cron job is missing; rerun supabase/setup-stock-recovery.sql';
  end if;
end $$;

select j.jobname,j.schedule,j.active,
       r.created_at as requested_at,
       h.status_code,
       h.timed_out,
       h.content as recovery_result,
       case when not j.active then 'JOB_INACTIVE'
         when r.request_id is null then 'WAITING_FOR_FIRST_REQUEST_CHECK_CRON_HISTORY'
         when h.id is null then 'QUEUED_OR_RESPONSE_EXPIRED'
         when h.timed_out then 'HTTP_TIMEOUT'
         when h.status_code=200 then 'CHECK_RECOVERY_RESULT'
         else 'HTTP_ERROR' end as diagnostic
from cron.job j
left join lateral (
  select * from seen_private.stock_recovery_requests order by created_at desc limit 5
) r on true
left join net._http_response h on h.id=r.request_id
where j.jobname='seen-stock-recovery'
order by r.created_at desc nulls last
limit 5;

-- Healthy: recent status_code=200, timed_out=false and JSON retryRequired=0.
-- checked=0 is normal when no eligible reservations need checking.
-- 401: verify matching private Vercel/Vault token and redeployment.
-- 503/timeout: provider/database recovery needs another attempt; retain stock.
-- NULL status: newly queued request or expired short-lived HTTP response.
-- WAITING_FOR_FIRST_REQUEST: inspect the named job's SQL run history.
