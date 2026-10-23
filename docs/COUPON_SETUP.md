# Checkout discount codes

Updated 23 October 2026.

## Activate

1. Apply the existing multi-parcel update `supabase/migrations/20261023000300_multi_parcel_shipping.sql` first if still pending. The separate `supabase/enable-free-delivery-80.sql` controls the general GBP 80+ offer; it is not required to qualify for a free-delivery code.
2. In the existing Supabase SQL Editor, run the complete **`supabase/migrations/20261023000400_checkout_coupons.sql`**. Expected: **Success. No rows returned.** It adds private checkout redemption accounting, trusted discounted totals and an editable **FREEDEL** coupon. No existing order totals, product prices, stock or delivery settings are changed. Its default code is active, has no expiry, no minimum spend and no usage limit. Rerunning the migration preserves an owner's existing edits to that code.
3. Push/deploy the updated code. There are no new environment variables or Stripe permissions to add. The backend uses the existing Checkout Session permission; it does not create Stripe coupon/promotion-code objects.
4. Reload the storefront and admin. In **Bag** or **Checkout**, enter **freedel** and click **Apply**. Codes are case insensitive. An eligible reviewed standard-delivery selection should show GBP 0 delivery even below GBP 80. Remove code restores the normal rules. Reviewing does not make a payment.

The agent has not run this migration against the hosted project, created the production coupon, changed live settings or made a genuine payment. The code becomes available after the operator steps above.

## Manage codes

Open **Admin → Coupons**. Edit **FREEDEL**, or add a code and choose:

- **Free standard delivery:** waives the customer's standard-delivery charge, including supported multi-parcel selections. Express upgrades keep their charge. Actual Royal Mail postage is retained separately and still needs to be paid by the business.
- **Percentage:** a whole percentage of merchandise, rounded down to the nearest penny.
- **Fixed amount:** a merchandise discount entered in pounds.

Set Active, optional expiry, minimum merchandise subtotal and total usage limit as needed, then save the coupon. One code is accepted per checkout; codes are not stacked. A selected code is saved in the browser as a separate functional `.coupon` entry, and its value is always revalidated by the backend. Clear saved bag removes both standard/development bag and coupon entries.

Minimum spend and the general GBP 80+ delivery threshold use the original merchandise subtotal before coupon discounts. A percentage/fixed code reduces merchandise only; it does not separately waive delivery unless the ordinary free-standard-delivery offer already applies. Paid checkout requires at least GBP 0.30 of merchandise remaining; codes that would make the merchandise free or below that amount are rejected rather than opening an unsupported zero-value payment. Payment-method eligibility is still determined by Stripe.

## Trusted orders and retries

Applying a code is a read/validation step and does not reserve stock or a coupon use. Final checkout independently checks the code, active state, expiry, minimum spend, value/version and usage limit under a row lock. It reserves a use atomically with inventory. Paid or payment-attention orders consume that use; verified failed/expired orders release it through the existing webhook/recovery path. Pending payments keep it reserved. Retrying the same checkout reuses its original order and claim. Existing opened orders retain their agreed code and totals even if the owner later edits the campaign.

Sandbox and live counts are separate. There is no per-customer usage rule or account requirement in this release. Deleting and recreating a coupon creates a new campaign identity; disable a campaign to stop new uses while retaining its history.

Original product prices remain frozen in purchase snapshots. A separate immutable discount amount determines the payable total. Stripe line prices are allocated in integer pennies so their sum exactly equals discounted merchandise; no browser-supplied savings or amounts are trusted. Confirmation, admin Orders/Finance, and customer/owner email snapshots carry the same saved discount/code and paid total. Emails remain subject to the existing configured outbox/provider setup.

Royal Mail quotes are still required in calculated mode, even when standard delivery is waived. Missing weights, unsuitable parcels and carrier failures do not silently become free postage. The signed shipping quote binds the chosen coupon as well as the bag, address and store settings. The public Apply endpoint has a shared server-side attempt limit, including invalid-code attempts; operational coupon records and usage identities are not exposed publicly.

## Verification

Validation: production build and all 179 database/model checks passed. Eight distinct shipping/coupon browser checks passed across the full and focused runs, including a phone FREEDEL paid-order flow, desktop percentage-discount payment/confirmation, invalid-code/removal feedback and protected admin creation of a free-delivery campaign. Browser assertions completed; the Windows fixture-server teardown was interrupted after completion because the runner did not exit. All payment/carrier/database records were disposable fixtures; no real charge, hosted stock change or email was made. A real deployed acceptance check is separate; run the installation steps before testing the code on the public store.
