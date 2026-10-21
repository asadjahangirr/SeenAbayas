# Automatic stock management ? point 4

**Payment/domain continuation (21 October):** the developer selected live checkout on https://www.seenabayas.co.uk before coupons. See [DOMAIN_PAYMENT_SETUP.md](DOMAIN_PAYMENT_SETUP.md) and new 20261021000100_live_payments.sql; code supports verified live physical-stock deduction while preserving test reservation-only behaviour. Hosted activation is pending. Update the existing Vault recovery URL to the www hostname without changing its token or recreating the working Cron job. Earlier Vercel/test-only examples below belong to the previous checkpoint.

**Current checkpoint (21 October 2026):** hosted stock/order migrations were independently verified earlier. The developer has now supplied a successful setup status screenshot (seen-stock-recovery, every-minute schedule, active=true, request_table_ready=true) and a second screenshot showing two consecutive scheduled HTTP 200 responses, timed_out=false and recovery_result={checked:0,updated:0,retryRequired:0}. This establishes successful signed scheduled execution through the deployed application with no eligible work on those runs. It does not establish an actual hosted expiry/release, a fresh post-migration paid-order test or live physical-stock deduction. Keep test mode enabled; that provider/schema still rejects live charging.

The earlier missing-table/no-job problem is resolved in the supplied evidence. The setup originally rolled back on combined Vault-value validation; the corrected field-specific error later identified the URL entry as invalid. After the developer corrected that entry and reran setup, the job/table and successful HTTP outcomes were demonstrated. Exact malformed URL characters were not supplied, so do not invent them. The operator files retain private access, token byte preservation, strict endpoint validation and atomic rollback; only public URL boundary whitespace/trailing slashes are normalised. Do not rerun setup merely because old history records a failure. Use the read-only check file for routine observation.

Next development item in the requested order is point 5, checkout discount redemption. The latest user response confirms recovery results; it does not explicitly authorise implementing every subsequent phase. Fresh point-3/4 purchase/expiry acceptance remains recorded separately. No hosted schema, secrets, schedules, orders, reservations or stock were changed by the agent during this verification.

Checkout reserves the selected sizes in the database before opening Stripe. The bag itself does not reserve stock. Available stock is on-hand minus reserved; desktop and phone share the same inventory. Successful **sandbox** purchases release the reservation without selling physical stock. A guarded physical-stock deduction path is prepared and tested in an isolated database, but real-money checkout remains disabled by the existing test-only database/provider constraints.

## 1. Install the database update

In the existing Supabase project's SQL Editor, run the complete file:

`supabase/migrations/20261020000300_stock_management.sql`

It requires the installed payment and order-record migrations. Expected result: **Success. No rows returned.** It is rerunnable and installs protections/functions without changing existing quantities, orders, reservations, payment modes or prices. Historical stock movements are not invented. Run migrations in order; do not replay an older payment/order migration over this newer implementation.

Push/deploy the new code to Vercel. Keep `PAYMENTS_MODE=test`, sandbox keys and indexing disabled. There are no additional Stripe webhook events to add.

`npm.cmd run check:payments` now reports `stockManagementReady` and a presence-only `recoverySecretConfigured`. An installed stock migration does not prove that a recurring job is running.

## 2. Configure automatic recovery privately

Webhooks normally release expired checkouts. The recurring job also recovers missed callbacks and interrupted session creation without a customer return or an administrator opening the dashboard.

1. Generate a fresh random token privately. For example, run this in your own terminal and copy its output only into the private settings below:

   ```powershell
   node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

2. Add that token as `PAYMENTS_RECONCILE_SECRET` in **Vercel → Settings → Environment Variables → Production**. Add it privately to `.env.local` if you will test locally. Do not reuse a Stripe/Supabase key, prefix it with `NEXT_PUBLIC_`, put it in a URL, or paste it into chat/Git.
3. Redeploy the current Vercel deployment so the token is active.
4. In the same Supabase project, enable **Cron/pg_cron**, **pg_net** and **pgcrypto**. The setup expects pgcrypto's `hmac` function in the `extensions` schema, the usual Supabase extension location. Resolve a prerequisite error before rerunning; do not move an existing extension blindly.
5. In **Supabase Vault**, create two private entries (or update the existing entries with these exact names):
   - `seen_stock_recovery_token`: the same random token as the Vercel variable.
   - `seen_stock_recovery_url`: `https://seenabayas.vercel.app/api/payments/reconcile`.
6. Run the complete corrected `supabase/setup-stock-recovery.sql` in SQL Editor as the project database owner. It schedules **seen-stock-recovery** every minute and returns the schedule/active/table-ready status row described above. Rerunning replaces the named schedule rather than creating duplicates. It begins real recovery of this project's existing sandbox reservations; apply it after deployment/configuration, rather than as a read-only installation check.

The scheduler reads the token inside a private database function and queues only a short-lived, timestamped HMAC proof. The long-lived token is not included in queued HTTP headers. This matters because Supabase documents that pg_net request queues can be readable by database roles even when the original token came from Vault. The setup does not try to change platform-owned queue permissions. External trusted schedulers may alternatively send `Authorization: Bearer <token>` to GET/POST on the same endpoint; choose one scheduler instead of enabling duplicate jobs. Never send Stripe or Supabase privileged credentials as that header.

No CLI or extra hosting account is required for the Supabase Cron option. See the official [Cron setup](https://supabase.com/docs/guides/cron/quickstart), [Vault scheduling pattern](https://supabase.com/docs/guides/functions/schedule-functions) and [pg_net credential visibility explanation](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357).

## 3. Verify the recurring job

Verified operator evidence (21 October): setup status shows the active every-minute job and existing request table; the check screenshot shows two consecutive 200 responses with no timeout and retryRequired=0. checked=0 means no eligible work was processed. Routine observation uses supabase/check-stock-recovery.sql; it invokes no recovery and reads no tokens/customer details. A real hosted expiry/release and fresh paid-order acceptance remain separate checks.

In Supabase Cron, verify **seen-stock-recovery** is active. SQL job history records the enqueue, which alone is not successful HTTP recovery. Run the commented observation query at the bottom of `supabase/setup-stock-recovery.sql` to inspect actual HTTP outcomes for this job:

- **200** with `checked`, `updated`, `retryRequired` counters: the worker ran; no queued work can legitimately mean zero checked.
- **401**: Vercel and Vault tokens differ, the redeployment is missing or the signed timestamp is outside the five-minute allowance. Recheck settings privately.
- **503** or a timeout: keep reservations held, investigate provider/database connectivity and allow the next scheduled attempt. Do not clear reservation counters manually.
- **404** or an HTML response: verify the deployed path, preferred origin and hosting access/protection settings. A redirect/login page is not a successful recovery response.
- **NULL HTTP status**: the request may still be queued, or its short-lived pg_net response may already have expired. Compare recent request times and Cron history.

The worker checks up to five orders per run, rotates the queue and leases claims for two minutes to reduce overlapping work. A crashed run becomes eligible again. Increase worker capacity deliberately before sustained demand exceeds its throughput. Monitor repeated non-200 responses and unresolved orders; this setup does not install an external alert service.

Stop only the recurring job with `select cron.unschedule('seen-stock-recovery');`. This does not release held stock or stop Stripe webhook processing. When changing the website domain, update the Vault URL as well as the existing site/provider settings. Rotating the token requires matching Vercel/Vault values and a redeployment.

## 4. Stock behaviour and admin use

- Reservation and final movement happen atomically across all items. Insufficient availability rejects the complete checkout; another customer's valid reservation is never replaced.
- One final release or deduction is permitted per order/size. Repeated events/requests do not sell or release twice. Product locks precede inventory locks to agree with catalogue/admin operations.
- Known expiry/failure releases held units. Closing a tab by itself is not proof of cancellation. An overdue open Stripe session is explicitly expired and its returned state verified. Payment can win that race; a completed/pending payment is not released by the clock.
- Pending asynchronous payments retain stock until verified success/failure. Missed failure callbacks can require provider investigation/replay; the worker does not invent failure from elapsed time.
- Interrupted creation is recovered by provider metadata. An unattached reservation is released only after its creation window plus ten minutes and a complete provider lookup establishes absence. Failed, incomplete or time-bounded lookups keep it reserved for retry. High-volume lookup windows may need a more scalable provider index later.
- Paid orders with invalid delivery or inconsistent stock remain attention cases for owner investigation. Late payment after a released reservation never steals another order's stock.
- Products & stock already displays on-hand and reserved amounts. On-hand includes held units; never reduce it below reserved or manually clear reserved counters.
- Admin order details now explain **Reserved for checkout**, **Reservation released**, **Test reservation released**, **Deducted from stock** or an attention state. **Refresh payment statuses** remains an owner/MFA-protected manual fallback; a leased order can take two minutes to become eligible again.
- Private `seen_private.checkout_stock_events` records new per-size reservation/releases/deductions with quantity and physical-stock delta. It is not a public inventory API or a complete history of manual adjustments. Existing orders gain truthful terminal events when settled, without fabricated historical reservation entries.

For user-run sandbox acceptance, use currently available shared stock and configured shipping. Two Burgundy size-58 pieces total GBP 90 with free standard delivery if those units are still available. Verify the paid test order and timestamps from point 3. Its reservation should become zero and on-hand should stay unchanged. Separately, an abandoned test checkout should release after provider expiry and the next successful recovery pass. Do not leave multiple unfinished tests holding the only available units, and never reset stock merely to make a test pass.

The existing [Stripe expiration guidance](https://docs.stripe.com/payments/checkout/managing-limited-inventory.md?payment-ui=stripe-hosted) describes the provider expiry/event mechanism. Shipping below GBP 80 and Royal Mail integration remain queued; no delivery rate was invented here.

## Verification limits

Current local results: production build passed; all 88 database/model checks and all 18 payment/order/stock browser/API checks passed. These cover stock-event privacy, once-only settlement, invalid/multi-item rollback, lease rotation, a prepared physical deduction, HMAC expiry/tampering, competing buyers, provider outages, missed callbacks, verified session expiry/orphan recovery, retained asynchronous reservations and existing phone/desktop/admin flows. No hosted mutation or automatic job activation was performed by the agent.

Database/model checks use isolated PGlite. Browser/API checks use a local provider simulator and isolated database, never hosted orders, stock or charges. The competing-buyer test exercises simultaneous application requests against serialized fixture transactions; it is not a multi-connection production PostgreSQL load/deadlock test. The future physical deduction branch is tested by relaxing the test-only constraint only inside a rolled-back fixture transaction; the actual schema retains that constraint. Supabase Cron/Vault/pg_net operation must be verified in the hosted project after operator setup. Real charging, live provider settlement, refunds, coupons and email/carrier workflows remain separate work.
