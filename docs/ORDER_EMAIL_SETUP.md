# Automatic order emails — SEEN ABAYAS

Implemented 21 October 2026. Activation and genuine mailbox delivery still need the operator steps below. No email password is needed, and this is separate from Supabase Auth email or Stripe receipts.

## What happens

After the store verifies a successful payment and confirms the canonical order, two separate emails are queued:

- Customer confirmation goes to the customer email saved from the verified checkout.
- Owner notification goes to **info@seenabayas.co.uk**. Replies go to the customer; customer replies go to the support inbox.

Both contain the order number, UK confirmation date, purchased names/references, sizes, quantities, unit prices, line totals, subtotal, delivery, added tax, total paid, customer contact details and delivery address/service. The design uses ivory, ink, restrained typography and a mobile-friendly single-column layout, with plain-text alternatives. It does not claim dispatch, invent delivery dates or expose payment tokens/card information. Owner notifications link to the protected admin dashboard. Customer emails link to support and returns information, rather than an unauthorised order lookup.

Failed, abandoned, unpaid, pending and attention/review checkouts do not receive a paid-order confirmation. This phase covers paid-order notifications; dispatch, refunds, returns and low-stock alerts are later workflows.

## 1. Create the sending account and verify the domain

You confirmed access to Namecheap DNS. Use your own email to create/sign in to [Resend](https://resend.com/). For the final handover, arrange client ownership/access and billing. You do **not** need the password for info@seenabayas.co.uk.

1. In Resend → Domains → Add domain, add **mail.seenabayas.co.uk**. This is a sending subdomain; the support inbox remains info@seenabayas.co.uk.
2. Open Namecheap → Domain List → seenabayas.co.uk → Manage. Check the authoritative nameservers. If DNS is managed at Namecheap, open Advanced DNS. If custom nameservers delegate DNS elsewhere, add the records at that provider instead.
3. Copy the exact **sending** DKIM and SPF/return-path DNS records shown for your domain in Resend. Use the displayed type, value and MX priority. In Namecheap's Host field omit the final `.seenabayas.co.uk`; for example a complete `resend._domainkey.mail.seenabayas.co.uk` name becomes `resend._domainkey.mail`. Do not substitute example DNS values from a guide.
4. Preserve all existing website records and the existing mailbox MX records. Do not enable Resend Receiving/Inbound or replace the root domain's MX records. A sending return-path MX on the specific subdomain Resend names is different from redirecting your existing mailbox. If Namecheap requires switching Mail Settings, preserve every existing mail-provider MX record before doing so; do not blindly replace the list.
5. Back in Resend, select Verify DNS records and wait until the sending domain shows **Verified**. Keep open/click tracking off for these transactional emails. Review DMARC with the actual existing domain configuration; do not add a second conflicting record.

Official references: [verified sending domains](https://resend.com/docs/dashboard/domains/introduction), [Namecheap DNS instructions](https://resend.com/docs/guides/dns/namecheap).

The recipient inbox must already exist and receive mail. DNS verification for sending does not create a mailbox or give access to it.

## 2. Add private email settings

In Resend → API Keys create a **Sending access** key restricted to the verified sending domain where available. Privately add it as `RESEND_API_KEY` in `.env.local` and Vercel → this project → Settings → Environment Variables → Production. Never paste it into chat, Git or frontend variables.

Add these values in the same two places:

```dotenv
# Sender address under the domain verified above. Plain address, no display name.
ORDER_FROM_EMAIL=orders@mail.seenabayas.co.uk
ORDER_EMAILS_ENABLED=true
# Optional: an inbox you control, for sandbox delivery tests only.
# Leave empty to suppress sandbox emails.
ORDER_EMAIL_TEST_RECIPIENT=
```

Keep `NEXT_PUBLIC_SITE_URL=https://www.seenabayas.co.uk` on Vercel. Local development retains its localhost origin. Keep all existing payment keys, payment mode, recovery token and Supabase configuration unchanged. `RESEND_API_KEY` is the same integration setting used by the contact adapter, but **order emails do not require Turnstile**. Setting up order email does not activate the Contact form by itself. Do not replace an existing working contact key with one lacking access to its sender domain.

If a different sending domain was verified, use an address on that exact verified domain for `ORDER_FROM_EMAIL`. The sender appears as SEEN ABAYAS, and customer Reply-To remains info@seenabayas.co.uk.

## 3. Install the private queue, then deploy

1. Open the existing Supabase project → SQL Editor. Run the **entire** [20261021000200_order_emails.sql](../supabase/migrations/20261021000200_order_emails.sql). Expected result: **Success. No rows returned**. It requires the existing live-payments migration. It does not send email, modify stock, create payments or email historical orders. It is safe to rerun.
2. Push the code using your normal Git workflow and let Vercel deploy the latest commit/environment changes. Wait for Ready. Restart the local dev server for local env changes.
3. Keep the existing `seen-stock-recovery` every-minute Supabase Cron job active. It now also drains/retries the email queue through the existing signed `/api/payments/reconcile` endpoint. No new job, Vault secret, webhook destination or Stripe permission is required. Its response retains the stock counters and adds an `emails` result.

Install SQL before activating/deploying the sender so new confirmed orders are durably queued. New orders confirmed after installation are queued even while sending is disabled; they send once configured. Existing already-paid orders are deliberately not backfilled, preventing an unexpected email blast. Check any purchases made before installation manually.

## 4. Verify before calling email delivery complete

1. Sign in with owner account/MFA. Admin → Overview → **Check order email setup**, or open `https://www.seenabayas.co.uk/api/admin/order-emails`. Expected: `configured=true`, `issues=[]`, `database=ready`, `ready=true`. This is read-only; it checks configuration/database, not provider authentication or actual delivery. A 404 means the new route has not reached the deployment.
2. To test without real money, use the separate sandbox environment already configured for testing; do not switch the public live site for every visitor merely to test email. Set `ORDER_EMAIL_TEST_RECIPIENT` privately to an inbox you control and complete a new valid sandbox checkout. Both messages go to that inbox with **[TEST]** and **Do not dispatch** labels, regardless of fictional customer details. Never alter real stock or invent shipping rates to make a test possible. If no valid basket is available, resolve test availability/shipping separately.
3. In Admin → Orders, expand that order → **Order emails** → Refresh email status. Each recipient should say **Accepted by email provider**. Resend → Emails shows subsequent delivery/bounce information. Confirm both messages actually arrive and inspect them on a phone. Acceptance alone does not prove inbox placement.
4. Default sandbox behaviour with no controlled recipient is **Sandbox email skipped**. Suppressed older tests are not later resent when the recipient is configured. A new sandbox purchase is needed.
5. Keep Production payment mode live as previously configured. When a genuine customer places a verified live order, their confirmation goes to their checkout email and the owner email goes to info@seenabayas.co.uk. A genuine charge is not required for installation or read-only checks; any deliberate real payment/refund acceptance test needs separate coordination.

No live email delivery was verified while implementing this phase. Local tests use isolated database fixtures and mocked email responses; they do not send messages.

## Reliability, privacy and troubleshooting

- Payment confirmation and two unique queue entries commit in the same database transaction. Browser redirects, admin-editable JSON, duplicate webhooks and polling cannot independently manufacture duplicate notifications.
- A worker lease prevents competing handlers from claiming the same email. The complete provider request is frozen before sending; retries reuse that body and stable idempotency key, even after content/sender configuration changes. Each recipient has independent state, so one successful email is not resent when the other fails.
- Failed network requests/temporary provider failures retry with backoff through the existing Cron job. A failed email never reverses a paid order or changes stock. Unavailable settings leave messages queued. Permanent malformed-request failures are marked for review.
- Local `PAYMENTS_MODE=test` workers can only claim sandbox notifications, even when the Supabase project is shared with Production. Live workers can process live notifications plus controlled/suppressed sandbox messages. No production email can be drained by a local sandbox worker.
- Resend idempotency keys last 24 hours. The worker stops automatic retries after 23 hours from the first frozen send attempt if acceptance is uncertain. **Needs attention** requires inspecting Resend logs before deciding whether a manual message is needed; do not reset counters/delete rows or blindly resend. [Provider idempotency reference](https://resend.com/docs/dashboard/emails/idempotency-keys).
- **Queued:** check sending settings, deployment and the existing recovery job. **Sending:** a worker holds a two-minute lease; a stopped worker becomes recoverable. **Accepted:** Resend accepted the API request, not necessarily inbox delivery. **Needs attention:** inspect Resend/account/domain/recipient status. **Skipped:** sandbox delivery was not enabled.
- Queue snapshots contain private customer/delivery information and frozen email bodies. Tables are private with RLS; only protected server RPCs can access them. Owner status endpoints require MFA, return no customer addresses/content/secrets, and use private/no-store responses. Do not expose queue tables or log raw provider errors. Align actual order/email retention and the Resend processor disclosure with the business privacy policy before launch.
- These are transactional messages, not newsletter subscriptions. No customer is added to a marketing list. Configuring Resend does not install analytics, marketing tracking, a receiving mailbox or Supabase Auth SMTP.
- Sender/configuration changes apply to new email attempts. Already-frozen messages retain their original routing/content for safe retries; coordinate a sender/key/domain change while pending emails exist.
