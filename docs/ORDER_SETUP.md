# Automatic order records — point 3

The existing checkout creates a private pending record and freezes the selected products before redirecting to Stripe. Verified provider success confirms that same record, rather than creating a second order. Signed webhooks work even when the customer never returns to the confirmation page; return-page status checks and owner reconciliation use the same idempotent database operation.

Current checkpoint (20 October): the developer confirms migration installation and a Ready deployment. Independent hosted checks report `order_records_ready=true`, retain both earlier paid sandbox orders with matching provider/item totals and saved contact/address data, and expose both new timestamp columns. Those older orders correctly have no confirmation timestamp. Public review confirms test payments remain available for two size-58 Burgundy pieces at GBP 90. Admin API requests without a session return 401 and the order page redirects to login. No authenticated hosted admin UI or fresh post-migration payment has been inspected yet; a new user-run sandbox checkout is the remaining acceptance check. The numbered installation steps below are retained for reference.

## Install this update

If a GBP 45 checkout shows payment unavailable, check delivery before changing Stripe settings: below-GBP-80 standard delivery pricing is still unconfirmed. A deployed read-only review returned `paymentAvailable=false` and no calculable total for one Burgundy piece, while two pieces at GBP 90 returned `paymentAvailable=true` with free delivery. The developer confirmed encountering the one-piece case on Vercel. The UI now identifies the missing delivery rate rather than saying "Payment coming soon"; deploy this wording update separately. The developer requests queuing Royal Mail integration for delivery calculation instead of supplying a flat rate now; account/API pricing capabilities need verification in that phase. A valid below-threshold charge must be configured before those orders can proceed. Local `PAYMENTS_MODE` remains disabled; this is separate from the deployed test configuration and was not changed during diagnosis.

1. In the existing Supabase project's SQL Editor, run the entire `supabase/migrations/20261020000200_order_records.sql` after the payment migration already installed. Expected result: **Success. No rows returned.** It is rerunnable and refreshes existing order displays without creating payments, changing product prices/stock or enabling real charges.
2. Push/deploy the current code to Vercel. Keep the existing sandbox keys and `PAYMENTS_MODE=test`. No additional credentials, webhook events or Stripe products are required.
3. Open **Admin → Orders** and review an existing paid test order. Its saved items, quantities, sizes, prices, contact details, delivery address and totals appear as readable sections. Historical paid orders can have no recorded confirmation time; the migration deliberately does not invent one.
4. For a fresh sandbox purchase, use available stock and an eligible shipping total. At this checkpoint two Burgundy size 58 pieces total £90 and qualify for free standard delivery, subject to current shared availability. Use only Stripe's published card test fixtures. A new successful test records confirmation/verification times and remains labelled **Test · Do not dispatch**. Do not test with real charges.

`npm.cmd run check:payments` now includes `orderRecordsReady`. A false value means the new migration is absent or could not be verified; it is separate from basic payment connectivity. Never print or share environment keys.

## What is saved and protected

- One checkout/order ID and order number survive retries and duplicate events. A provider PaymentIntent cannot be assigned to two orders.
- Private item snapshots retain product references, purchased names, sizes, quantities, unit prices and photos. Line totals are projected from the stored quantities/prices, not browser totals or current catalogue prices.
- The final validated Stripe shipping address and available final email/phone update the record before confirmation. The original contact name and shipping recipient are displayed separately.
- Verification and confirmation times are captured once when the backend first verifies success. These are observation times, not Stripe settlement timestamps. Paid orders needing review remain unconfirmed and cannot be dispatched.
- Admin presentation is rebuilt from private checkout/order data. If the presentation record is missing, a provider retry can repair it. Existing notes/tracking and later fulfilment state are preserved. An unchanged replay does not invalidate an open admin form by incrementing its version.
- Confirmed customer details, item snapshots, purchase identity and original financial totals cannot be overwritten through normal updates. Admin editing permits fulfilment/tracking/notes only; it cannot invent a payment or manually confirm an unpaid order.
- Both public and ordinary authenticated roles are denied private orders and payment RPCs. Owner membership and MFA remain required to inspect customer records in admin. No new public order lookup is introduced.

## Admin workflow

Search by reference, customer or saved product. Filter payment and fulfilment separately, and switch between customer/test orders. Expand an order for contact, address, purchased-item table, totals, confirmation dates and optional provider references. The existing fulfilment form remains below these details.

**Export CSV** downloads the filtered selection with one row per purchased size. It includes customer/delivery details and saved prices. Order totals repeat on each item row; sum line totals when analysing items. Spreadsheet formula protection remains applied. The existing latest-1,000-record snapshot limit still applies; this is not an unlimited historical export.

Awaiting payment, awaiting confirmation, failed/expired attempts and paid orders needing review remain visibly distinct. Pending checkouts are not dispatch-ready orders. Test orders remain excluded from commercial Finance totals and cannot be shipped.

## Scope and validation

This completes the order-record workflow on the current test-mode payment integration. It does **not** activate real-money charging, sell physical inventory, redeem coupons, initiate refunds, send transactional emails or create Royal Mail labels. Those are separate remaining phases. Klarna's external sandbox blank-page investigation and physical Apple Pay acceptance testing remain open; card and Clearpay sandbox success were verified earlier.

Database/security checks use isolated PGlite. Browser checks use the local Stripe simulator and MFA-enabled admin fixture, not the client's products or customer records. A passing simulated suite is separate from hosted installation and an actual provider payment. Follow Stripe's [webhook fulfilment guidance](https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted) when extending this workflow.
