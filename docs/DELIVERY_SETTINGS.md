# Delivery fee, free delivery and banner

Updated 22 October 2026. These controls use the existing protected CMS publication flow; no new SQL migration, Stripe key or environment variable is required. Deploy the updated code to expose the clearer controls. The agent has not changed hosted rates, products or payment mode.

**Royal Mail addition:** fixed-fee controls themselves need no new SQL. The new private parcel settings/calculated-price mode require `20261022000100_shipping_quotes.sql` first; see [ROYAL_MAIL_SETUP.md](ROYAL_MAIL_SETUP.md). In carrier mode the actual customer delivery charge comes from the verified Royal Mail quote, with the configured standard free-delivery rule applied; the fixed amount is used only in fixed mode.

## Owner workflow

1. Sign in with the owner account and authenticator. Open **Admin → Store settings**.
2. In **Shipping & order settings**, enter **Standard delivery charge (£)**. This is the fixed amount charged to the customer when their order does not qualify for free standard delivery. Enter `0` for no charge; blank means unconfirmed and blocks non-qualifying payments.
3. Set **Complimentary UK delivery** to Enabled or Disabled. When enabled, **Free delivery threshold (£)** is the merchandise subtotal that qualifies. Exactly the threshold qualifies. Express upgrades retain their separate fee. **Minimum order (£)** is a separate restriction.
4. In **Delivery announcement**, edit **Banner message**. Use `{threshold}` instead of typing a fixed amount: for example, `Complimentary UK delivery on orders of {threshold} or more`. The preview substitutes the current threshold.
5. **Use automatic delivery message** restores the standard template. It automatically stops advertising free delivery when the offer is disabled. Custom text is preserved; review custom offers when changing the rule. You can also hide the banner or change colours, speed and destination.
6. Click **Save & update store**. **Save draft** stays private. Open store tabs refresh through the existing synchronisation. Verify the banner and checkout total after publishing.

The same stored fee/threshold drives the bag, checkout review, trusted backend total and Stripe shipping amount. The standard fee also appears on Shipping & Delivery. A previously displayed review must be refreshed when its charge changes. Already-created Stripe Checkout Sessions retain their original order quote; new settings apply to new checkout sessions. Setting a store fee does not purchase Royal Mail postage or connect Click & Drop.

## Controlled genuine purchase acceptance

The store currency remains **GBP**. A one-pound item is **£1.00**, not one US dollar. Product prices can already be changed in **Products & stock → Edit → Price (£)**. Publishing a temporary price makes it visible to all customers; restore the correct price promptly. No test price or stock was changed by the agent.

Before the client makes a genuine purchase, publish the intended standard fee (or an explicitly chosen zero fee), free-delivery rule and minimum order. Review the complete payable total including delivery. Use accurate contact/delivery details and a real payment method for the genuine purchase; test cards belong only in Stripe's sandbox. Very small purchases may not qualify for buy-now-pay-later methods; their absence does not by itself indicate a broken integration.

After a genuine successful purchase, verify:

- Stripe LIVE shows the payment succeeded in the client's SEEN account.
- The confirmation page shows the correct order reference, items and delivery/total.
- Admin Orders shows the matching customer order as Paid/Confirmed.
- Stock is reduced by the purchased quantity, once.
- The buyer receives the confirmation; `info@seenabayas.co.uk` receives the owner notice.
- Finance reflects the verified purchase. Stripe bank payout timing is separate from payment success.

Record results without sharing card details, keys or customer data. Do not reset inventory/reservation counters to erase the purchase. Refunds incur their own provider/operational handling; connected refund controls are a separate pending feature. Do not promise an automatic refund from this website.

## Validation of this change

22 October results: production build passed; all six focused checkout/model checks passed; both complete delivery-settings browser journeys passed at 393/1440 px (24.9s/26.1s). The initial browser run timed out on an exact-label dropdown selector; using the existing accessible combobox role fixed the test without an application workaround. Passing report: isolated QA copy `qa-reports/delivery-settings-verified.json`. No real charge, provider object, hosted settings or stock change occurred. The new controls still require deployment before appearing on the live site.

Run the focused model checks with `npm.cmd run test:catalog -- tests/catalog/checkout.spec.ts`. Browser coverage is in `tests/live-payments-ui/delivery-settings.spec.ts`; run with the live-payment UI config after building. It uses disposable databases and fake Stripe at 393/1440 px, not actual live payments. It checks private drafts, publication, fixed fee, exact threshold, offer disablement, zero/blank distinction, stale-review rejection and the provider total.
