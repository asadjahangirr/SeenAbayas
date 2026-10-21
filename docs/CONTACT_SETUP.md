# Contact form: Admin Inbox delivery

The client requested website enquiries in **Admin → Inbox**, without contact emails or Turnstile. Purchase-confirmation and owner order emails remain separate.

## Install and enable

1. In the existing Supabase project → SQL Editor, run the complete `supabase/migrations/20261021000300_contact_inbox.sql`. Expected result: **Success. No rows returned.** It adds protected inbox ingestion, retry receipts and shared rate limits. Installation does not edit existing messages, orders, payments or stock. It is safe to rerun.
2. Keep the existing Supabase URL, publishable key and server-only `SUPABASE_SECRET_KEY` in `.env.local` and Vercel Production.
3. Set `CONTACT_DELIVERY=inbox` in both environments. Inbox is also the default if this variable is absent. `CONTACT_INBOX_ENABLED` only controls the optional copy in email mode; it is not required for inbox mode.
4. Deploy the updated code after applying SQL. Restart the local server if changing local environment settings.

No Cloudflare account, widget, CAPTCHA keys, contact sender or additional Resend configuration is needed for inbox delivery. Keep the existing Resend/order email settings for purchase notifications. Never expose a Supabase server secret through `NEXT_PUBLIC_` or paste credentials into chat.

## Customer and admin behaviour

- Name, email, phone and message are required. Client and server validate fields, origin, JSON/body size, honeypot and submission age.
- The backend stores the message through a server-only protected RPC. It becomes unread in Admin → Inbox. Only authorised administrators with MFA can view it.
- The customer sees success only after the database confirms storage. A failure preserves the message and permits retry. Repeating the same request reference/payload neither duplicates the message nor consumes another quota slot.
- An owner deleting a message cannot have it reappear merely because a timed-out browser retries the original submission during its retry window.
- Admin controls include read/unread, archive/unarchive, filters and deletion. Reply by email opens the administrator's email application; the form does not send a customer acknowledgement or marketing signup.

## Abuse limits and privacy

The database atomically enforces **3 new messages per sender per 15 minutes**, **6 per network per 15 minutes**, and **30 total per minute**, shared across serverless instances. Retries do not consume limits. A limit produces HTTP 429 with retry feedback. A short row lock serialises quota checks and insertion.

On Vercel the server uses the platform's `x-vercel-forwarded-for` address. Arbitrary `x-forwarded-for` headers are not trusted. Outside Vercel, the fallback network bucket is shared rather than trusting an unconfigured proxy. See [Vercel's request-header documentation](https://vercel.com/docs/headers/request-headers).

Rate identities are keyed HMAC hashes; raw network addresses are not saved in the receipt table. Receipts also contain a payload digest and request ID. Receipts older than 24 hours are pruned on the next accepted submission. This is not an exact timed erasure schedule. Messages remain private until an administrator deletes them; the business must confirm its retention policy. Hosting logs are governed separately by the hosting configuration. Shared-network limits can affect customers on the same network; email remains an alternative contact route.

## Verification

- Database/handler checks cover private access, durable insertion, duplicate protection, changed-payload rejection and shared sender/network/global limits.
- `npm.cmd run test:inbox-ui` uses an isolated local database and the real Next.js contact API, without any email or CAPTCHA provider. It exercises the customer form and protected admin inbox controls on mobile and desktop. It shares ports with admin/payment suites, so run them sequentially.
- The optional email-mode UI suite remains `npm.cmd run test:contact-ui` with synthetic provider configuration.
- After deployment, submit one clearly labelled test message through `/contact`. Sign in with the owner account/MFA, open Admin → Inbox and verify its name, email, phone and message. Remove the test message when finished. Do not submit card details or other sensitive information.

A disabled form indicates missing backend configuration. A submission error can indicate that the SQL has not been applied, server credentials do not match the project, or a network/database operation failed. Do not grant anonymous users access to the private inbox to work around an error.

## Optional email delivery

Only if the owner later requests contact emails, choose `CONTACT_DELIVERY=email` and configure a verified Resend sender plus Turnstile keys using the provider's official instructions. This legacy email path retains its security verification and process-local limiter; it does not weaken the inbox-only path. `CONTACT_INBOX_ENABLED=true` additionally copies provider-accepted emails to the private inbox. Order emails do not depend on this selection.
