# Checkout preview - 20 October 2026

**Later payment checkpoint, 20 October:** test-only Stripe sessions, private orders, transactional reservations, signed webhooks and a private confirmation page are now implemented. Read [STRIPE_SETUP.md](STRIPE_SETUP.md) for current activation steps and limits. The description below records the preview phase and remains the behaviour while payments are disabled. Stripe connectivity and the payment migration have now passed read-only hosted checks. The developer reports all four requested methods enabled. A deployed webhook and an actual provider test checkout remain separate verification steps.

## Current phase

Point 1 of the remaining feature list is implemented as a UK guest checkout **review preview**:

- `/bag` has **Continue to checkout**.
- `/checkout` has responsive contact/address fields, configured Royal Mail options, item photographs, quantity/size summary, estimated totals, field/error-summary validation and an editable review screen.
- `POST /api/checkout/review` validates a bounded same-origin request, re-reads published prices/settings and checks current stock through the same read-only source used by the bag.
- Empty/unavailable bags, minimum orders, unknown delivery fees, network failure/retry and changed selections have explicit states.
- The checkout is noindex. It uses the existing CMS text wrappers, supports the Checkout media target and authenticated draft preview.

**It does not create orders, reserve/decrement inventory, take payment, send email, store addresses or create Stripe sessions.** Entered personal details stay in the current page's memory; review sends them to the server for validation and returns the formatted details with a private/no-store response. Reloading clears the form; bag IDs/quantities remain saved. There are no payment-card inputs or simulated order-success states.

## Latest answers from the developer

1. The website is UK-based. This preview accepts UK (`GB`) addresses, including Northern Ireland postcode formatting; final shipping destinations/exclusions still need explicit confirmation before real payment activation. Crown Dependencies are not silently treated as UK addresses.
2. **Orders of GBP 80 or more get free standard delivery.** The store bears that shipping cost. This supersedes the earlier strict-over rule: exactly GBP 80 now qualifies.
3. Royal Mail remains the intended delivery partner.
4. VAT status/treatment is unconfirmed.
5. The delivery fee below the threshold, express availability/rate and service/dispatch estimates were not supplied. Do not invent them.
6. The developer has access to the client's Stripe dashboard and permission to configure requested methods. No Stripe API keys have been added and no payment-provider writes were made during this phase.

## Delivery and estimates

- Default free-delivery threshold remains 8,000 integer pence and is inclusive for nonempty eligible merchandise selections.
- The bag, banner's default/legacy stock message, footer, product disclosures, FAQs, shipping page and terms wording follow the inclusive rule.
- Published CMS `commerce` settings still control the threshold and whether the offer is enabled.
- Unknown charges remain `null`, not zero. Below-threshold orders do not show a fabricated delivery price or total. If a charge is genuinely configured in Store settings, the preview can display it.
- Standard delivery is shown; express appears only when explicitly enabled in published settings. An express charge is not made free by the standard-delivery offer.
- Tax remains unconfirmed and amounts are labelled estimates, not payable totals. No VAT amount or inclusion assumption is made.
- Custom administrator-written marketing copy is preserved. Review any custom announcement/text overrides for consistency with the updated delivery rule.

## Next implementation

The developer has now requested all previously mentioned methods, including Clearpay. [STRIPE_SETUP.md](STRIPE_SETUP.md) records their dashboard/key setup steps. The first setup response is pending; payment-session/webhook/order code has not been added merely by creating that guide or its blank environment placeholders.

1. Verify Stripe test-mode access/permissions and privately configure the required test credentials when implementing payments. Keep all secret keys in environment settings, never in chat or Git.
2. Design/install the transactional order/payment/event/reservation/coupon schema and server operations; the current generic admin order records are not a payment backend.
3. Connect Stripe-hosted Checkout using server-calculated totals and approved shipping/tax rules. Decide how the reviewed address maps to provider collection so customers do not enter it twice unnecessarily.
4. Handle signed webhooks, idempotency, pending/failed/expired sessions and inventory reservation/release before claiming real checkout works.
5. Add securely authorised Order Confirmation, admin order/finance integration, refund workflows and transactional emails.

No new SQL migration, secret, dependency or external service configuration is needed just to view this preview. Existing Supabase catalogue/bag/admin migrations remain required for their existing features. Real payment activation needs the unresolved commercial settings and provider integration.

## Verification

Build before browser suites:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:catalog
npm.cmd run test:checkout-ui
npm.cmd run test:catalog-ui
```

The checkout browser suite uses the isolated admin fixture on ports 3106/3107; run sequentially with admin/mobile suites sharing those ports. It tests UK validation, current server prices, request tampering/origin/body limits, no personal-data persistence, duplicate-submission prevention/retry, responsive layouts/accessibility and Android touch compatibility. It does not contact Stripe or write to hosted Supabase. Physical-device checks remain separate.

Main files: `src/components/checkout/checkout-page.tsx`, `src/app/checkout/`, `src/lib/checkout/model.ts`, `src/app/api/checkout/review/route.ts` and shared `src/lib/bag/server.ts`.

Completed validation: final production build, 65 database/model checks, 11 checkout browser checks, 13 catalogue/bag checks, five delivery/product/FAQ/banner checks and one admin threshold/publication check passed (95 distinct automated checks across the completed runs). Desktop/phone screenshots were reviewed. Physical Android/iPhone testing and real Stripe payment verification are not covered by these results. No hosted writes, migrations, charges, email sends, commits, pushes or deployments were performed.
