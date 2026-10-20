# Stripe test payments - SEEN ABAYAS

Updated 20 October 2026. The Stripe-hosted payment flow is implemented for **test mode only**. Live keys and `PAYMENTS_MODE=live` are rejected. Installation, configuration and a verified Stripe transaction are separate checkpoints.

## Status

Order-record extension (point 3): `20261020000200_order_records.sql` adds confirmed/verified timestamps, purchase-update guards and canonical admin projections; the app replaces raw order JSON with readable contact/delivery/items/totals, payment/environment filtering and item-level CSV. Apply/deploy as described in [ORDER_SETUP.md](ORDER_SETUP.md). The original payment migration alone does not install this extension. Existing sandbox orders are retained; real charging remains unsupported.

The developer pushed aff54b1, configured Vercel's main deployment and enabled PAYMENTS_MODE=test. Checkout returns 200; webhook GET returns 405 as expected. Unsigned requests are rejected. A signed diagnostic for a nonexistent order performed only a protected lookup, with no payment/order/stock mutation. The public review API verifies test payment availability, GBP totals, secure ownership cookies and private/no-store responses. CLI access is disabled for this invitation; Dashboard webhook setup is working without it.

The first hosted card sandbox payment is independently verified: Stripe marked it paid in test mode, GBP 225 matched the saved private paid order, its reservation was released, and the actual completion event had zero outstanding webhook deliveries. Clearpay success is now independently verified too: the actual method was `afterpay_clearpay`, its PaymentIntent succeeded, GBP 300 matched the saved paid test order, the reservation was released, and its completion event had zero outstanding webhook deliveries. These checks were read-only; the developer completed the payments in their browser. The intended test endpoint is enabled at https://seenabayas.vercel.app/api/payments/stripe/webhook. Stripe's default sandbox configuration reports card, Apple Pay, Klarna and Clearpay available/display on. Klarna is visible but its completed test and a physical Apple Pay test remain pending.

The reported wrong-card concern was clarified as using Stripe's published 4242 success card with a changed three-digit CVC. That card accepts any valid three-digit CVC; the provider recorded the simulated check as passed. Use explicit decline fixtures below to simulate failure. No code fix was needed for this expected behaviour. Local mode was not edited by the agent; Vercel test mode was verified remotely. The numbered setup steps below are also retained for fresh environments; do not rerun completed migrations blindly. Live charging remains unsupported.

## 1. Install the database update

In the existing Supabase project's SQL Editor, run the complete file `supabase/migrations/20261020000100_payments.sql`. Expected result: **Success. No rows returned.** This additive, rerunnable migration installs private test orders/items, event receipts, reservation functions and admin protections. Installation does not create orders, alter stock or enable payments. Existing catalogue/admin migrations, including bulk visibility `005`, must already be installed. Resolve an absent dependency rather than blindly rerunning the original non-rerunnable schema.

## 2. Dashboard webhook without CLI

1. Deploy the current code to a stable **public HTTPS Vercel website** with payments initially disabled. A purchased domain works only after it actually serves that deployment. Localhost cannot receive Dashboard webhooks directly.
2. In the client's **sandbox/test** environment, open **Workbench / Developers > Webhooks**, or [Stripe Webhooks](https://dashboard.stripe.com/webhooks). Choose **Create an event destination** (older screens may say Add endpoint).
3. Choose **Your account**, **Snapshot** payloads, and these four events only:

   ```text
   checkout.session.completed
   checkout.session.async_payment_succeeded
   checkout.session.async_payment_failed
   checkout.session.expired
   ```

4. Choose **Webhook endpoint**. Enter the actual public origin plus `/api/payments/stripe/webhook`, for example only `https://your-store.vercel.app/api/payments/stripe/webhook`. Use the final HTTPS host directly, without redirects or authentication screens. Choose snapshot API version `2026-09-30.endive` if offered, matching the SDK; the handler re-fetches sessions through its own SDK version.
5. Reveal the destination's signing secret (`whsec_...`) and add it privately to `STRIPE_WEBHOOK_SECRET` in Vercel and `.env.local`. This differs from the API secret. Never send keys in chat/screenshots or commit them.
6. Configure the values below in the same Vercel deployment scope and redeploy after environment changes. Local edits do not configure Vercel.
7. If event delivery shows `401/403` with a Vercel sign-in/protection page, the endpoint is protected. Use the intended public test site or configure the supported hosting protection bypass with the project owner. Stripe cannot bypass hosting authentication automatically. If the Stripe invitation also blocks webhook/secret access, the client owner must create the destination or grant appropriate access.

Official instructions: [Stripe Dashboard webhook destinations](https://docs.stripe.com/webhooks). This handler expects **snapshot Event payloads**, not thin events.

## 3. Environment and activation

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-actual-test-site.vercel.app
CATALOG_SOURCE=supabase
CMS_SOURCE=supabase
SITE_INDEXING_ENABLED=false
PAYMENTS_MODE=disabled
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SUPABASE_SECRET_KEY=
```

Keep the existing Supabase public URL and publishable key. `SUPABASE_SECRET_KEY` is a separate server-only key for the same project. Never prefix a secret with `NEXT_PUBLIC_`. Use the client's `sk_test_...` key, never a live key. Restricted `rk_test_...` keys need Checkout session, Customer and payment read permissions plus access for the read-only connectivity check.

After migration/keys/webhook are ready, set **PAYMENTS_MODE=test** and restart/redeploy. Missing configuration keeps checkout in review-only mode. Existing test webhook/status/recovery handling continues while the mode is disabled, provided credentials stay configured.

Use the local origin in local configuration and Vercel's HTTPS origin in Vercel. A deployed Dashboard webhook can update the shared database for a checkout begun locally, but this does not prove delivery to localhost. Prefer testing the complete deployed flow.

## 4. Test an actual sandbox checkout

- Use a published product with an active size and enough **shared available stock**. Desktop and phone use the same inventory. Never change hosted stock merely to make a test pass without understanding and authorising the affected records.
- Use merchandise of **GBP 80 or more** for known free standard delivery, or configure/publish an approved below-threshold fee. An unknown charge blocks payment instead of becoming free. VAT remains unconfirmed; no VAT assumption is made for live selling.
- Enter **test customer details**, review and select **Continue to test payment**. A private test order and stock reservation are created before the redirect to Stripe.
- Use [Stripe test payment methods](https://docs.stripe.com/testing), never a real card for testing. Check success, failure and cancellation. Apple Pay verification needs a compatible real device/wallet; emulation cannot establish wallet availability.
- Check Stripe **Event deliveries** and **Admin > Orders**. Confirmation is private to the checkout browser. Visiting a return URL never marks payment as paid. Pending payments remain pending until provider verification.
- Retry an interrupted request: it must recover the same session/order. Replayed events must not release stock twice.

Sandbox success releases its reservation **without decrementing physical on-hand stock**. Orders are marked **Test - Do not dispatch**, excluded from commercial revenue/order totals and cannot be dispatched through admin. The bag is intentionally kept for retesting. Closing a browser alone does not cancel a session; explicit cancellation expires an open provider session and releases only after verification. Pending asynchronous payments retain reservations until verified success/failure.

## 5. Methods and branding

Sessions dynamically offer eligible methods restricted to **card, Klarna and Afterpay/Clearpay**. Apple Pay is an eligible card wallet. Stripe decides eligibility for the account, customer, device and order; enabling a method does not guarantee it appears for every visitor. Do not promise a specific instalment plan or treat Klarna as cash on delivery.

Configure the approved business name/logo/colours in Stripe Checkout branding. Client bank details belong in private merchant onboarding, not source code or documents. An invitation does not require Stripe Connect; this store needs no separately maintained Stripe product catalogue or browser publishable key for its server-side hosted redirect.

References: [hosted Checkout](https://docs.stripe.com/checkout/quickstart), [dynamic eligibility](https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods), [Apple Pay](https://docs.stripe.com/apple-pay?platform=web), [Klarna](https://docs.stripe.com/payments/klarna), [Clearpay](https://docs.stripe.com/payments/afterpay-clearpay).

## 6. Recovery and boundaries

Owner-only **Refresh payment statuses** in Admin > Orders checks a rotating batch of up to five reserved checkouts. Repeat for more. Point 4 adds two-minute recovery leases; an already claimed order can need that interval before another manual check. Network/provider failures retain reservations for retry. `GET/POST /api/payments/reconcile` supports a private Bearer token; POST also accepts a short-lived HMAC proof for Supabase Cron. Configure the recurring job using [STOCK_SETUP.md](STOCK_SETUP.md) and `supabase/setup-stock-recovery.sql`; it is prepared but not activated by editing local code. The same setup guide covers the required `20261020000300_stock_management.sql` migration. Configure and verify regular recovery before commercial launch.

Unattached provider sessions are recovered by metadata. Orphan reservations are released only after their frozen creation window plus ten minutes and a complete bounded Stripe lookup confirms absence. Indeterminate lookups retain stock. Attention cases require owner investigation and cannot be auto-fulfilled.

This phase does **not** redeem coupons, calculate VAT, initiate/synchronise refunds, send transactional emails or automate Royal Mail labels. Do not apply external refunds and assume financial synchronisation. Final VAT, lower-order delivery charges, service/destination rules, business/policies, actual catalogue/stock, refunds, emails and operational protections remain required before live launch. Real charging cannot be enabled by this phase.

## Verification

```powershell
npm.cmd run check:payments
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:catalog
npm.cmd run test:payments-ui
npm.cmd run test:checkout-ui
```

Browser tests use fake credentials, actual SQL in PGlite and the installed Stripe SDK's requests/signature verification against a local simulator. These are not certification of an actual Stripe sandbox checkout. Admin/checkout/mobile/payment browser suites share ports 3106/3107: run sequentially. The internal `PAYMENTS_FIXTURE_ORIGIN` override accepts only the exact dummy keys and loopback database; it cannot receive real credentials or hosted data and is absent from `.env.example`.

## Deployment sequence for the selected test site

The developer confirmed the requested environment variables were saved in Vercel's Production scope. This is user-reported configuration; the agent has not inspected Vercel's private environment values. A subsequent read-only check still returned 404 for both `/checkout` and `/api/payments/stripe/webhook`, so publishing the current code remains the next step. Keep payments disabled for the initial deployment.

The developer prepares Git commits/pushes. After all Vercel values have been saved for the main site, publish this tested commit from main through the existing Git-connected deployment. The default remains disabled; set PAYMENTS_MODE=test and redeploy when ready for sandbox shopping. Confirm NEXT_PUBLIC_SITE_URL=https://seenabayas.vercel.app in Vercel, while local development keeps its local origin. This remains a sandbox payment environment even when Vercel labels the main deployment Production.

```powershell
git add .
git commit -m "Add secure test checkout and Stripe payments"
git push
```

These commands include the already-reviewed earlier checkout/delivery/handover work still uncommitted in this workspace. .env.local is ignored; .env.example is intentionally tracked with blank secrets. Inspect git status before committing any additional unrelated work. The agent has not executed these commands.

## Separate payment-method acceptance tests

Run one checkout at a time using sandbox keys. A failed attempt can leave its Stripe session open for retry; use the site's explicit Cancel this test checkout flow if abandoning it. Closing a browser does not immediately release its reservation. The saved bag is deliberately retained for repeated tests. Enabled/visible methods are not proof of a completed payment for every method.

### Card success and failure

Stripe's success card `4242 4242 4242 4242` accepts any valid three-digit CVC and future expiry. Changing 123 to 456 does not simulate an incorrect CVC. To test that failure, use `4000 0000 0000 0127` with any three-digit CVC and future expiry. A generic decline uses `4000 0000 0000 0002`. Neither attempt should lead to a paid order unless a subsequent actual successful test payment is made. A malformed number, two-digit CVC or invalid expiry month should be rejected as invalid input. Reference: [Stripe testing](https://docs.stripe.com/testing).

### Clearpay

Start a fresh checkout from the saved bag, choose Clearpay on Stripe and click Pay. Complete the successful simulated authentication on the sandbox redirect page. Stripe also documents a **Fail test payment** action on the test redirect for a separate failure scenario. Confirm the SEEN return page, actual provider method `afterpay_clearpay`, saved order totals/state and eventual reservation release. Reference: [Stripe Clearpay checkout testing](https://docs.stripe.com/payments/afterpay-clearpay/accept-a-payment?payment-ui=checkout).

### Klarna - published UK sandbox fixtures

Current investigation (20 October): the developer reports a blank page on `pay.test.klarna.com` in laptop Chrome after using arbitrary customer details. Read-only checks found two unfinished Klarna test sessions: both unpaid with PaymentIntent `requires_action`, no recorded last payment error/decline, and matching private open orders with reservations retained. The browser has reached Klarna's external sandbox; the reason its page is blank is not yet established. Do not describe this as a successful Klarna test, infer that arbitrary data caused the blank page, or loosen the store's CSP. Cancel abandoned sessions through their SEEN confirmation page before creating more; closing a tab alone does not cancel them. Retry with the approved UK fixtures below. If it still fails, inspect the first browser console/network failure without sharing private redirect URLs, tokens or customer details. An extension-free Chrome profile is a useful isolation check; begin the entire checkout there to retain its own ownership cookie.

Start a fresh SEEN checkout using Stripe's published approved UK Klarna test customer details, rather than arbitrary identity data. This is test-provider data, not the client's identity:

- First name: Test; last name: Person-uk.
- Email: `customer@email.uk` (approved scenario).
- Address line 1: `10 New Burlington Street`; line 2: `Apt 214`.
- Town/city: London; postcode: `W1S 3BE`; country: United Kingdom.
- Test phone: `+447755564318`.
- If Klarna requests date of birth: `10-07-1970`.
- Select Klarna on Stripe, click Pay and follow the sandbox redirect. If it asks for a two-step code, `123456` is valid; `999999` simulates authentication failure.
- If a test repayment credit card is requested inside Klarna, its published test number is `4111 1111 1111 1111`, CVV `123`, with any valid future expiry. These are Klarna test-flow values, separate from the initial Stripe card test.

Use the provider's documented declined-customer fixtures for a separate failure scenario. Repayment plans depend on provider eligibility. Reference: [Stripe Klarna checkout testing](https://docs.stripe.com/payments/klarna/accept-a-payment?payment-ui=checkout).

### Apple Pay

Use an eligible Apple device/browser with Apple Wallet configured; iPhone Safari is a suitable first device check. Stripe-hosted Checkout needs no additional website-domain registration for Apple Pay. In Stripe test mode, the wallet uses an existing real card in Apple Wallet to generate a test token without charging it. Do not try adding `4242…4242` to Wallet: Stripe documents that those test cards cannot be added to Apple Pay for this test. Never paste a real card number into chat or into these test instructions. An Android/desktop card test does not verify Apple Pay rendering or authorization. Reference: [Stripe Apple Pay testing](https://docs.stripe.com/apple-pay?platform=web#test-apple-pay).

Record each method separately: appeared, redirect/wallet opened, success/failure simulation, truthful SEEN return state, matching provider/private order and reservation settlement. Keep live charging disabled until the remaining commercial and operational work is complete.
