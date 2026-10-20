# Stripe test payments - SEEN ABAYAS

Updated 20 October 2026. The Stripe-hosted payment flow is implemented for **test mode only**. Live keys and `PAYMENTS_MODE=live` are rejected. Installation, configuration and a verified Stripe transaction are separate checkpoints.

## Status

The developer reports Cards, Apple Pay, Klarna and Afterpay/Clearpay enabled in the client sandbox. Read-only requests accepted the privately configured Stripe test key and Supabase server key; no key, balance or customer details were printed. At that check the new payment migration and webhook were absent. Run `npm.cmd run check:payments` for a fresh read-only check.

CLI access is reported disabled. **Use the Dashboard webhook below; the CLI is optional.** The Checkout product's Preview badge is not proof of test mode. No agent-created provider sessions, hosted stock changes or hosted SQL installation have been performed; browser tests use isolated dummy credentials and PGlite.

Latest hosted check: the developer applied the payment migration and corrected the server credential privately. Stripe test connectivity, Supabase connectivity and `payment_health` now pass. The webhook secret is still pending and payments remain disabled at this check. The selected public test website is **https://seenabayas.vercel.app** and the exact Dashboard endpoint is **https://seenabayas.vercel.app/api/payments/stripe/webhook**. This is the intended address, not proof that the latest code or endpoint has been deployed.

Later update: the developer created the Dashboard destination and added its signing secret privately. The read-only check now reports all three connections/configuration requirements ready, with mode still disabled. A direct public GET to the webhook currently returns **404**, confirming the new endpoint is not deployed at that address yet. Vercel settings and deployment have been requested. After deployment, a browser GET may return **405 Method Not Allowed** because the webhook accepts POST; verify Stripe Event deliveries rather than treating a browser GET as a payment test.

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

Owner-only **Refresh payment statuses** in Admin > Orders checks a rotating batch of up to five reserved checkouts. Repeat for more. Network/provider failures retain reservations for retry. Optional `GET /api/payments/reconcile` requires `Authorization: Bearer <PAYMENTS_RECONCILE_SECRET>` with a private random secret of at least 32 characters. Use a scheduler supporting that header; no scheduler is deployed automatically. Configure regular recovery before commercial launch.

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
