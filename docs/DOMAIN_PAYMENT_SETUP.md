# SEEN ABAYAS — final-domain and payment setup

Prepared 21 October 2026 for **https://www.seenabayas.co.uk**. The developer requests real customer payments plus testing, with **no additional tax charged**. This is a checkout calculation decision, not evidence of VAT registration/exemption; business disclosures still need the client's actual facts.

## Current findings

**Current verified checkpoint: live configuration is enabled.** The developer supplied requested/configured/ready modes all live, database ready and issues empty after correcting the retained sandbox pair. Independent public checks now confirm Secure checkout, HTTP 200/private-no-store, a read-only GBP 90 review with mode=live/paymentAvailable=true/taxStatus=none/free standard delivery/Secure HttpOnly ownership cookie. Unsigned webhook POST is rejected with 400, unauthenticated recovery and owner diagnostic GET with 401. No order, customer, Checkout Session, inventory reservation or charge was created. This supersedes the preview/configuration-blocker observations below.

Actual LIVE restricted-key access is not yet independently tested: the workspace has only the test key, whereas the live pair is in Vercel. Added an explicit owner+MFA read probe at the existing diagnostic's `?stripe=read` query, with **Check Stripe read access** in Overview. It reads only Checkout Sessions/Customers (limit one, future-only creation filter) and the current Stripe account if permitted. It returns statuses and optional charges/payouts booleans only, not records, identifiers, errors, balances or credentials. New code needs deployment and an owner-triggered check; it does not require new SQL, credentials or environment changes. Production build, eleven focused configuration/read-probe checks and five isolated live browser/API checks passed. Write permissions, actual live payment/webhook acceptance and payment-method eligibility remain untested. See read-access instructions below.

### Earlier troubleshooting checkpoints (superseded by the live result above)

**Blocker identified by deployed owner diagnostic:** requestedMode=live, configuredMode=null, readyMode=null, database=not_checked. The two reported issues are `STRIPE_TEST_SECRET_KEY` (expected a correctly formatted test server API key) and `STRIPE_TEST_WEBHOOK_SECRET` (expected a correctly formatted sandbox destination signing secret). This establishes which retained-sandbox settings fail validation, not whether they are absent versus malformed; their actual values were not shared. Correct both in Vercel **Production**, using the client's sandbox API key and sandbox www webhook's signing secret, then redeploy. Preserve the live primary pair, PAYMENTS_MODE=live, PAYMENTS_TAX_MODE=none and existing database/recovery settings. Do not weaken the retained-sandbox guard, rerun SQL or reset stock. Expected next diagnostic: requested/configured/ready modes live, database ready, issues empty; actual Stripe permissions remain not_tested until a provider request is validated.

**Repeated preview result and diagnostic (21 October):** after the developer corrected a mismatched variable and reported another Ready deployment, the read-only review still returned mode=preview/paymentAvailable=false/taxStatus=unconfirmed/GBP 90 total/free delivery/no ownership cookie. The corrected variable name was not supplied, so no exact root cause is claimed. Prepared an owner-and-MFA-only read-only diagnostic at `/api/admin/payments/readiness`, linked from Admin Overview as **Check payment setup**. It reports allowlisted failing setting names/messages, sanitised modes and database readiness without exposing values, calling Stripe or writing commerce data. Deploy this code before using that route; installation is application-only, with no new SQL. See troubleshooting below.

**Latest live-switch check (21 October):** after the developer reported PAYMENTS_MODE=live and a Ready deployment, the deployed review instead returned mode=preview, paymentAvailable=false and taxStatus=unconfirmed for an otherwise valid GBP 90/free-delivery bag. Checkout returned 200 without secure/test checkout wording; no ownership cookie was issued. Unsigned webhook POST remained 400, unauthenticated recovery 401 and canonical www correct. A separate protected read-only health check of the locally configured Supabase project confirmed live/order/stock capabilities and tax_mode=none. Thus live checkout is currently unavailable, not verified enabled. Exact deployed environment mismatch has not been identified; Vercel secret values/scopes were not inspected. Verify the live API key prefix, both retained sandbox variables, distinct correctly mapped webhook secrets, exact PAYMENTS_TAX_MODE=none and the deployment's Production variables before another redeployment. Readiness does not call Stripe APIs, so this preview response does not establish a restricted-key permission failure. Do not rerun SQL or reset stock to address it. No order, reservation or charge was created.

**Credential-staging checkpoint:** the developer confirms saving the restricted LIVE primary API key/live signing secret and retained sandbox pair in Vercel, with PAYMENTS_MODE=test, and a Ready deployment. Fresh public checks after this change returned checkout 200/test wording/private-no-store; review 200/mode=test/paymentAvailable=true/GBP 90 total with free standard delivery and Secure/HttpOnly ownership cookie; unsigned webhook POST 400; unauthenticated recovery 401. These establish deployed mode/readiness and basic request protections, not actual provider API acceptance or inspection of Vercel secret values. The final live mode switch/redeployment is next under the existing explicit request for real payments. No order, reservation or charge was created by the agent.

After the developer confirmed SQL installation, URL updates and a Ready deployment on 21 October, fresh read-only checks verified: www homepage 200 with canonical `https://www.seenabayas.co.uk`, apex 308 to www, checkout 200 with test wording/private-no-store, unauthenticated recovery 401 and webhook GET 405. Protected database health reports order, stock and live-payment capabilities ready, with zero-added-tax support. Live capability does not mean checkout is currently charging real money.

The sandbox account has exactly one enabled webhook destination at the new www path covering all four required events. The public catalogue returns nine designs; Burgundy remains GBP 45 with size 58 available. A read-only deployed review for two pieces returned mode=test, paymentAvailable=true, GBP 90 subtotal/total, zero delivery and a Secure/HttpOnly ownership cookie. This review created no order, reservation or payment and stored no customer details.

The developer subsequently confirmed a fresh new-domain sandbox payment returned Test payment complete and its admin order is Paid/Confirmed. They also confirmed the newest scheduled recovery results show HTTP 200, no timeout and retryRequired=0 after the URL change. These are operator-reported acceptance results, not a new independent inspection of order/customer records, provider event deliveries or physical stock. Live merchant activation/credentials, actual Klarna completion and physical Apple Pay acceptance remain unverified. The next step is preparing the live account/credential pair while retaining test checkout, then explicitly switching PAYMENTS_MODE to live after verification.

The code now supports disabled/test/live checkout, separates credentials for old sandbox orders, verifies event/order environments, and commits physical inventory only after verified live payment. It has **not** been deployed or activated by the agent. No real payment, refund, hosted stock edit or external dashboard change was performed. A connected domain alone does not activate Stripe live payments.

## 1. Vercel domain and database capability

Open **Vercel → this project → Settings → Domains**. Ensure `www.seenabayas.co.uk` points to the intended Production deployment and has valid HTTPS. Keep `seenabayas.co.uk` redirecting to www; this already worked in the read-only check. Do not change working Namecheap DNS or mailbox MX records merely to configure payments.

In the **existing Supabase project → SQL Editor**, run the entire:

`supabase/migrations/20261021000100_live_payments.sql`

Apply it after the installed payment/order/stock migrations, without rerunning those older migrations or the catalogue import. Expected result: **Success. No rows returned.** It adds live capability and a zero-tax snapshot column, preserves the test RPC/orders, and keeps signature/amount/environment/publication/reservation/owner protections. Installing it does not create charges, change product prices or quantities, or enable checkout by itself.

Push/deploy the new application code. Keep checkout in **test** while updating the domain and proving the new-origin flow below. No new dependency installation is required beyond the existing lockfile.

## 2. Stripe sandbox webhook — move it to the new domain

Open the client's Stripe **sandbox/test environment → Workbench/Developers → Webhooks**. Edit the existing SEEN snapshot event destination's URL to:

```text
https://www.seenabayas.co.uk/api/payments/stripe/webhook
```

Keep **Your account**, **Snapshot** payloads and these four events:

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
```

Copy/reconfirm that destination's signing secret privately. If editing is unavailable, create a replacement destination with those settings; its signing secret differs from the old destination. Avoid leaving duplicate active destinations once the replacement works. A signing secret is not a Stripe API key. Use the direct www URL, not a redirect or admin page. [Stripe destination setup](https://docs.stripe.com/webhooks).

Keep the sandbox API key and this sandbox signing secret. After live cutover they go in `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET`. Old unpaid sandbox orders still need these credentials for expiry/recovery.

Existing Checkout Sessions keep their frozen return URL. Do not rewrite private order identity/return URLs to move them. Finish/cancel existing sandbox checkouts or let verified provider expiry release them. Test the new origin with a **fresh** bag/review/checkout; browser ownership cookies and saved bags are scoped to the website hostname. Old private order links/cookies do not automatically transfer between domains. Admin order records remain in the same database.

## 3. Vercel environment — first test on the new domain

Open **Vercel → Settings → Environment Variables → Production**. Set:

```dotenv
NEXT_PUBLIC_SITE_URL=https://www.seenabayas.co.uk
CATALOG_SOURCE=supabase
CMS_SOURCE=supabase
SITE_INDEXING_ENABLED=false
PAYMENTS_MODE=test
PAYMENTS_TAX_MODE=none
```

At this stage keep `STRIPE_SECRET_KEY` as the sandbox API key and `STRIPE_WEBHOOK_SECRET` as the sandbox destination signing secret for the new URL. Keep the existing Supabase URL/public key, server-only Supabase secret and recovery token. Do not replace the Supabase project URL with your website domain.

Redeploy the **latest code** after saving environment changes and wait for Ready. Environment edits do not update an already-running Vercel deployment. This also fixes the stale canonical/site origin and makes newly created Stripe return/cancel URLs use www automatically. You do not manually paste a Checkout Session's success/cancel URL into Stripe's branding settings. [Vercel environment behaviour](https://vercel.com/docs/environment-variables).

Local development may keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000` in `.env.local`. Local and Vercel variables are separate. Keep secrets out of chat, screenshots and Git. `.env.example` intentionally has placeholders only.

## 4. Supabase Vault — change only the recovery URL

Open **Supabase → Vault** and edit the existing entry named:

```text
seen_stock_recovery_url
```

Set its secret VALUE to the plain URL:

```text
https://www.seenabayas.co.uk/api/payments/reconcile
```

Keep `seen_stock_recovery_token` unchanged and matching Vercel's `PAYMENTS_RECONCILE_SECRET`. The scheduled function reads the URL on every run, so an already-working job does not need to be deleted/recreated for this edit. Never put the token in the URL.

After 1–2 minutes run `supabase/check-stock-recovery.sql`. Expect the active every-minute job, HTTP 200, no timeout and `retryRequired=0`. Zero checked orders can be normal. If 401, verify the matching token and redeployment; if 404/HTML, verify the URL and public deployment. Do not reset reservations to work around configuration errors. See [STOCK_SETUP.md](STOCK_SETUP.md).

## 5. Supabase Auth — website and admin callbacks

Open **Supabase → Authentication → URL Configuration**:

- **Site URL:** `https://www.seenabayas.co.uk`
- **Redirect URLs:** add both exact entries below:

```text
https://www.seenabayas.co.uk/admin/auth/callback
https://www.seenabayas.co.uk/admin/auth/callback?intent=email
```

Retain exact localhost callbacks only if you still develop locally. Review obsolete Vercel entries after old recovery/email links have expired. Avoid broad production wildcards. Sign in again on the new hostname and verify MFA/recovery/email-change flows; domain cookies do not migrate by copying a URL. Existing admin users, memberships and MFA do not need recreating. Supabase Auth SMTP/email templates are separate from the contact form's Resend adapter. [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

## 6. Contact, domain email and other URL settings

If using Cloudflare Turnstile, open **Cloudflare → Turnstile → existing SEEN widget → Settings → Hostname Management**. Add `www.seenabayas.co.uk` (hostname only, no scheme/path). The verified apex redirect can stay; adding the apex hostname also authorises its subdomains if desired. Keep localhost only for actual development. Retain the existing site/secret keys unless deliberately rotating them. [Turnstile hostname settings](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/).

If contact sending is configured, verify **Resend → Domains** still verifies the sending domain used by `CONTACT_FROM_EMAIL`, and that `info@seenabayas.co.uk` receives enquiries/Reply-To works. A website domain change does not require replacing a valid Resend API key. Do not replace existing MX records. If contact providers are still unconfigured, changing the domain does not activate them. See [CONTACT_SETUP.md](CONTACT_SETUP.md).

In Stripe's business/public-details settings, set the website/support URLs to the real SEEN domain and supplied support email. Confirm the client's actual business identity, payout onboarding and merchant activation in the **live** account. Updating website URLs is not merchant approval. In SEEN Admin, review Website text and Store settings for manually entered old Vercel links. Existing relative links, product/media routes, logo, video, catalogue IDs and Supabase Storage bucket do not need moving to a new provider.

Keep search indexing disabled during this setup. Final canonical/metadata, policies, approved business details and SEO are separate launch work; domain connectivity is not approval of unfinished content.

## 7. Prove sandbox payments before live cutover

Use the new www domain, fictional details and sandbox methods only. Available stock is shared with the storefront; testing temporarily holds it. GBP 80 **or more** still receives free standard delivery. Below-GBP-80 delivery is unconfigured and remains blocked rather than silently becoming free. Royal Mail pricing/integration remains queued.

Test Card, Clearpay, Klarna and Apple Pay eligibility on the new origin. Card success uses Stripe's published `4242 4242 4242 4242`, any valid three-digit CVC and a future expiry. Use the existing UK Klarna fixtures in [STRIPE_SETUP.md](STRIPE_SETUP.md); its previous external sandbox blank-page issue was not established as fixed. Confirm success in Stripe, private confirmation and Admin → Orders → Test orders, including saved details/timestamps. Sandbox completion should release the reservation and preserve on-hand stock. Also verify failed/cancelled/pending behaviour and recent signed webhook delivery 2xx results. [Stripe testing values](https://docs.stripe.com/testing).

Apple Pay is an eligible card-wallet option on the **Stripe-hosted** page. This integration does not render an embedded wallet button, require Stripe.js or need a separately purchased Stripe Checkout custom domain. Hosted Checkout requires no additional Apple Pay domain registration. Enable/check Apple Pay in the correct Stripe environment, then test on a supported Apple device/browser with a usable Wallet. Do not paste Stripe's 4242 card into Wallet. The official sandbox Wallet procedure uses test API keys and does not make a real charge. [Stripe Apple Pay guidance](https://docs.stripe.com/apple-pay?platform=web).

## 8. Prepare the client's LIVE Stripe environment

Switch Stripe Dashboard out of the sandbox into the client's **live** business account. Verify merchant activation and enable the requested methods there: **Cards, Apple Pay, Klarna and Afterpay/Clearpay**. Sandbox enabled status does not establish live enabled status; approval, eligibility, device, currency and customer/order restrictions can affect what appears. Do not promise a specific Klarna plan before the merchant/customer is eligible.

Create a **separate live snapshot webhook destination** at the same www webhook URL and select the same four Checkout events. Keep the sandbox destination/credentials for sandbox order recovery. Privately copy the **live** destination signing secret. Open **Stripe Dashboard → Developers/API keys** (or the direct [API keys page](https://dashboard.stripe.com/apikeys)) in the client's live account for its live server key. If your invitation does not permit viewing/creating live keys or activating a method, the client owner must complete that step or grant the appropriate access; CLI access is not required. Live and sandbox keys/objects/signing secrets are distinct. Do not use a publishable key as `STRIPE_SECRET_KEY`. Do not put a secret behind a `NEXT_PUBLIC_` name. [Stripe key environments](https://docs.stripe.com/keys).

## 9. Enable real payments in Vercel

### Restricted-key compatibility

The backend accepts both `rk_live_` and `sk_live_` (and both test prefixes). A standard unrestricted key is not required. The developer created a live restricted key from the One-time payments template and explicitly confirmed **Checkout Sessions: Write** and **Customers: Write**. These match the direct production SDK calls. The rest of the template's resource list and actual restricted-key request acceptance have not been verified; do not equate a configuration check or a test using an unrestricted sandbox key with live restricted-key validation. Stripe supports restricted keys as replacements with resource-scoped Read/Write access: [restricted API keys](https://docs.stripe.com/keys/restricted-api-keys).

Direct production calls currently require **Checkout Sessions: Write** (create/expire plus retrieve/list for verification and recovery) and **Customers: Write** (explicit customer creation and Checkout customer updates). Write includes read. Checkout creates inline prices/products and a shipping rate; verify the equivalent restricted sandbox key with the actual payload and inspect Stripe permission errors for any dependent resources rather than claiming an untested exact-minimum scope. Do not grant all resources just to avoid diagnosing an error. No direct PaymentIntent, Charge, Refund, Payout or Balance API calls occur in the production checkout paths. Webhook signature verification itself uses the `whsec_` secret locally, then retrieves the Checkout Session with the environment's API key; receiving callbacks does not require API access to create/manage webhook endpoints.

Refund processing is **not implemented**; a refund field in an order record is not a refund API integration. No key can activate that missing workflow. Future refund permissions must be reviewed when implementing it. The optional `check:payments` script now uses the same bounded read-access probe instead of the earlier Balance lookup. Balance read permission is not needed for this diagnostic or checkout. Successful reads do not establish write permissions.

With a primary LIVE key, new checkout in `PAYMENTS_MODE=test` selects `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET`. With a primary TEST key, it uses the primary pair instead. Callback/recovery credentials follow the signed event/immutable order environment, independently of the current new-checkout mode. This preserves existing live and sandbox transactions; test mode does not cause a live event to use a sandbox signature. Four focused offline configuration tests, including restricted live/test keys, separate signing secrets and missing-sandbox fail-closed cases, passed. They establish configuration routing, not the real key's permissions or merchant approval. Payouts enabled and sandbox success do not independently establish live charge/method activation.

For a staged cutover, first copy the existing sandbox API/signing values into `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_WEBHOOK_SECRET`, then put the live API/signing values into `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Keep `PAYMENTS_MODE=test`, redeploy and verify checkout still selects the retained sandbox pair. Keep both webhook destinations active. This stage prepares live callbacks/credentials without offering new real-money checkout. Confirm the client's live merchant activation and requested method statuses before the final mode switch below.

After code/migration and sandbox verification, set **Production**:

```dotenv
NEXT_PUBLIC_SITE_URL=https://www.seenabayas.co.uk
PAYMENTS_MODE=live
PAYMENTS_TAX_MODE=none
STRIPE_SECRET_KEY=<client LIVE server key>
STRIPE_WEBHOOK_SECRET=<LIVE destination signing secret>
STRIPE_TEST_SECRET_KEY=<retained SANDBOX server key>
STRIPE_TEST_WEBHOOK_SECRET=<SANDBOX destination signing secret>
```

Keep `CATALOG_SOURCE=supabase`, `CMS_SOURCE=supabase`, the same Supabase credentials and recovery token. The two webhook signing secrets must differ. Save values privately, then redeploy and wait for Ready. Missing/mismatched credentials, missing live database capability or an unconfirmed delivery rate keep payment unavailable. Do not use `PAYMENTS_MODE=live` with test keys or merely replace a key in the old unmodified test-only build.

The live checkout displays **Secure checkout**, **Continue to secure payment** and zero added tax; successful provider verification confirms a genuine order, deducts purchased units exactly once and includes it in commercial admin/Finance. A matching unchanged purchased bag is cleared after verified success; an edited/new bag is preserved. Confirmation does not falsely promise that an email was sent. No tax-registration status is invented from the zero-added-tax setting. Set real stock and complete the actual business/policy/delivery information before inviting customers.

The agent will not initiate a real purchase/refund. A business-approved live acceptance purchase is a genuine charge and physical-stock deduction, unlike a simulated/sandbox test. Dashboard refunds do not currently synchronise into this application's unfinished refund workflow automatically; do not assume a refunded payment automatically restocks or updates Finance. Order/dispatch/refund emails, coupons, refunds/exchanges and carrier automation remain separate work.

## 10. Later testing, rollback and monitoring

### Verify Stripe read access without creating orders or charges

Deploy the latest read-probe code, sign in with the www owner account and MFA, then use **Overview → Check Stripe read access**, or open:

```text
https://www.seenabayas.co.uk/api/admin/payments/readiness?stripe=read
```

The plain diagnostic remains configuration/database-only. The explicit query performs three bounded Stripe GETs in the ready checkout environment; it cannot switch environments using URL parameters. Session/customer lists use a future creation-time filter to avoid fetching existing records. No creation, update, expiry, payment, refund, stock write or recovery is invoked. All results remain private/no-store and owner/MFA protected.

Share only `readyMode` and `providerAccess`. Expected environment is live, checkoutSessionsRead/customersRead passed and requiredReadAccess passed. The optional account read may be permission_denied with a restricted key; that does not mean checkout read access failed or that the app needs broader Account permissions. When permitted, chargesEnabled/payoutsEnabled show separate account flags. A false chargesEnabled must be resolved by the client in Stripe. Authentication_failed means the key was rejected; permission_denied on a required read identifies a scope to check on the actual deployed key; unavailable/rate_limited needs provider/network investigation. No raw provider error is returned.

`writePermissions`, `webhookDelivery` and `paymentMethodEligibility` deliberately remain not_tested. A successful GET cannot certify Checkout Session/customer creation, inline product/price/shipping dependencies, cancellation writes or an actual Apple Pay/Klarna/Clearpay transaction. Test a matching restricted sandbox key's complete flow separately; do not initiate a real transaction merely to turn a diagnostic green. Optional account-read denial alone is not a reason to request an unrestricted key.

### If live checkout still falls back to preview

Push/deploy the current diagnostic code, then sign in to the www Admin using the owner account and authenticator. On **Overview**, click **Check payment setup**, or open:

```text
https://www.seenabayas.co.uk/api/admin/payments/readiness
```

Share only `requestedMode`, `configuredMode`, `readyMode`, `database` and `issues`. No keys, actual environment values or customer records are included. Anonymous requests return 401; accounts without MFA and editors return 403; all responses are private/no-store. A 404 means that deployment does not contain the new route yet. `database=not_checked` is expected when configuration issues prevent a health lookup. `unavailable` points to the deployed server's Supabase connection/permissions; `live_migration_required` means that particular deployed project does not report the live capability. Do not rerun migrations blindly or reset inventory. A healthy live report has requested/configured/ready modes all live, database ready and no issues. `providerPermissions=not_tested` deliberately distinguishes setup readiness from actual Stripe acceptance. The diagnostic never initiates a payment, reservation, order or recovery.

The production build, seven focused configuration/diagnostic checks and five isolated live-mode browser/API checks passed after adding the route. Browser coverage checks anonymous/MFA/editor rejection, owner access, private caching, credential omission and unchanged provider/stock state. Earlier payment protections remain intact; the checkout guard was not relaxed. No hosted live credential acceptance or real payment is established by these tests.

To stop new checkout, set `PAYMENTS_MODE=disabled` and redeploy while retaining both sets of credentials. Existing paid/pending orders still need signature verification and provider reconciliation. To reopen sandbox checkout, use `PAYMENTS_MODE=test` with the live primary credentials retained and the sandbox pair populated; the code selects the sandbox pair for new test sessions. A Production test-mode switch affects all visitors, so do it only in a quiet agreed window; use a separately configured preview/test deployment for ongoing tests once customers are shopping. No public query parameter enables sandbox payments on a live checkout.

Do not delete pending/paid orders, event receipts, stock events or reserved counters during rollback/domain changes. Preserve the recurring recovery job and monitor Stripe event deliveries, Cron HTTP failures and unresolved orders. A full refund/customer-email/operational launch is not completed merely because live checkout is enabled.

Local commands: `npm.cmd run build`, `npm.cmd run test:catalog`, `npm.cmd run test:payments-ui`, `npm.cmd run test:live-payments-ui`. Browser suites share fixture ports and run sequentially. The live-mode suite uses exact dummy keys, loopback transport and isolated PGlite; it never charges money or touches hosted stock. `npm.cmd run check:payments` is a read-only configured-environment check and does not prove a successful purchase or dashboard method activation.

## Local verification at this checkpoint

Production build, 99 database/model checks, four isolated live-mode browser/API checks, 18 existing sandbox browser/API checks and 11 disabled-payment checkout checks passed. Live-mode simulation includes phone/desktop accessibility and once-only stock commit; no real provider charge/hosted stock write was made. Subsequent hosted read-only checks establish the installed live capability, new canonical, sandbox destination and test-payment review described above. The developer now reports successful fresh sandbox/admin acceptance and healthy scheduled recovery on www. Remaining dashboard callbacks, live merchant/key activation and real-payment acceptance still require verification. No full suite was rerun for these documentation/status updates.
