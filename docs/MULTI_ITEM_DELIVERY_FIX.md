# Multi-item delivery and the GBP 80 offer

Updated 23 October 2026.

The read-only hosted check found `maxItemsPerParcel=1`, nine configured size weights, and Royal Mail calculated pricing selected. The published free-delivery offer was disabled, with a GBP 2 threshold. The checkout error was the one-parcel capacity check, not an Add to Bag or inventory failure. No hosted records were changed during diagnosis.

## Activate the correction

1. In the existing Supabase project, open SQL Editor and run the entire `supabase/migrations/20261023000300_multi_parcel_shipping.sql`. Expected: **Success. No rows returned.** It requires the existing shipping/payment migrations and is rerunnable. It installs multi-parcel validation without changing business settings, orders, stock or measurements.
2. Run the entire `supabase/enable-free-delivery-80.sql`. This is a deliberate business-setting change requested by the owner: free standard delivery is enabled at **GBP 80 and above** in both the current draft and published settings. Expected result: `free_standard_delivery_enabled=true`, `threshold_gbp=80`. Unrelated draft edits remain private; existing orders and their agreed fees stay unchanged. The change advances the content version and retains history/audit records. Rerunning it without another change does not advance the version again.
3. Push/deploy the updated application code. No new environment variables or credentials are required. Keep the working Royal Mail authentication mode and payment settings.
4. Reload Admin and the storefront. If Admin had unsaved changes, copy them before reloading; its old version is deliberately rejected instead of overwriting newer settings. The automatic announcement now advertises the GBP 80 offer. If you use a custom banner, review its wording in Store settings.
5. Review checkout using a measured, in-stock size. Test two of the same GBP 40 design (GBP 80) and mixed GBP 40/GBP 50 designs (GBP 90): standard delivery should be GBP 0. Below GBP 80, the actual Royal Mail parcel quotes are combined. Reviewing does not open Stripe or purchase postage; do not continue to a live charge solely to check delivery.

You can subsequently manage the offer through **Admin → Store settings → Shipping & order settings → Complimentary UK delivery / Free delivery threshold**. A future explicit admin change still takes effect; the code does not permanently override these controls.

## How parcels work

Capacity now means pieces **per parcel**, not pieces per order. The current one-piece setting creates two parcels for two garments. If the measured packaging really holds more garments, update its capacity in Admin; do not increase it just to bypass a restriction.

The server sorts measured garments by weight and packs them into the configured parcel format, respecting both capacity and weight limits. It adds empty-packaging weight to every parcel. It quotes each distinct parcel weight once per review and reuses that result for identical parcels. The combined carrier cost is retained even when the customer receives free standard delivery. Express upgrades retain their charge.

The signed quote includes the parcel weights, quantities and postage costs. The transactional database independently rebuilds the packing plan from saved weights and validates totals before reserving stock. Changed measurements/settings, invalid or expired signatures, unknown weights, oversized individual garments and unavailable carrier prices still block checkout. There is no silent free-price fallback. A maximum of twenty parcels per checkout bounds provider work; larger orders need an agreed delivery arrangement.

This is checkout pricing. It does not buy postage, generate labels or automatically send shipments to Click & Drop. Fulfil the actual number of parcels through the client's existing Click & Drop process.

## Verification

The production build and 170 database/model checks passed using isolated fixtures. This includes consistent SQL/TypeScript packing across mixed weights, per-parcel capacity, quantity reservations, payment settlement, quote tampering, exact GBP 80 eligibility and safe/idempotent delivery-setting correction. Five distinct shipping browser checks also passed across completed assertion runs, including desktop repeat-item and phone mixed-product checkout totals. See the latest development notes for runner and fixture limitations. No real payment, hosted inventory mutation, label purchase or email was performed.
