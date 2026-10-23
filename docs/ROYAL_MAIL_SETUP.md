# Royal Mail setup for SEEN

## Multi-item update - 23 October 2026

The new multi-parcel adapter supersedes the one-parcel-only limit described later in this older guide. Capacity applies per parcel; checkout combines the measured parcel quotes and retains actual postage costs when standard delivery is waived. See [MULTI_ITEM_DELIVERY_FIX.md](MULTI_ITEM_DELIVERY_FIX.md) for required SQL, the explicit GBP 80 offer correction and deployment. The replacement key passed a read-only OLP check with raw authentication and returned 221 priced Royal Mail service entries. That is access evidence, not a live payment/fulfilment certification. Mandatory MFA references below also predate the password-only admin update.


Updated 22 October 2026.

**Implemented:** editable parcel/garment measurements, an owner/MFA-protected connection diagnostic, and server-calculated Click & Drop pay-as-you-go checkout quotes. Fixed delivery is the default. **Not activated or verified with the real carrier:** the saved key returned HTTP 401; account type, measurements, service codes and price/VAT interpretation remain unconfirmed. Automatic shipment creation, label retrieval and tracking synchronisation are separate unfinished fulfilment work.

## Urgent read-compatibility correction - 23 October 2026

If the deployed homepage/collection show server error `4202134668` after installing the shipping migration, run the complete **`supabase/migrations/20261023000100_shipping_read_compatibility.sql`** in the existing Supabase SQL Editor. Expected: **Success. No rows returned.** Refresh the store afterwards. This database read-only function correction takes effect without a website redeployment; the agent has not applied it to the hosted database.

The original shipping migration always added a top-level `shipping` key, even for older documents/fixed mode. The previous deployed site's strict content schema rejects that unknown key. On 23 October the public homepage and collection returned HTTP 500 with digest 4202134668, while admin login and public revision sync returned 200. The hosted public document passed the current schema and failed the prior schema solely on the unexpected shipping key; removing it restored validation. The prior public read therefore was not safe to install ahead of the new app deployment.

The correction omits `shipping` from fixed-mode public reads, allowing current code to use its existing fixed default and older code to keep its original contract. Calculated mode continues to expose only the required mode; private measurements/origin remain hidden. The original shipping migration has the same correction for fresh installs/reruns. Saved settings, orders, payments, reservations, stock and grants are unchanged. Do not reset inventory, rerun the initial catalogue migration, remove security checks or rotate working credentials for this error. Deploy the latest application code afterwards to obtain the new admin panel, keeping fixed mode until actual carrier access and inputs are ready.

## 1. Install the database update before publishing parcel settings

Open the existing SEEN Supabase project > SQL Editor. Run the complete:

`supabase/migrations/20261022000100_shipping_quotes.sql`

Expected: **Success. No rows returned.** It is rerunnable. It does not change existing stock, prices, orders, reservations or shipping settings. It installs private configuration reads, public configuration redaction, shared quotation limits and the protected carrier-quote order function. Keep the existing payment, stock-recovery and email migrations installed.

Run this migration before deploying the new admin panel. The API refuses custom parcel-setting saves until its protected capability check succeeds. Do not paste an API token into SQL or admin website text.

Then push/deploy the application changes normally. No Royal Mail webhook/callback is implemented for registration. The Stripe webhook URL is unrelated and stays unchanged.

## 2. Confirm the credential source

Ask the client to identify the page/product that issued the key, without sending credentials in chat:

- Click & Drop > Settings > Integrations > **Click & Drop API**, and whether the account is pay-as-you-go (OLP) or linked to an Online Business Account (OBA).
- If it came from the **Royal Mail developer portal**, the subscribed API/product name and its required credential types. Shipping/Tracking portal products are different integrations and may require a client ID plus client secret; one opaque token cannot identify or authenticate every product.

Do not delete an existing integration to experiment. The real authorised checks already performed were GETs to `/carriers`, `/services` and `/services/olp?country=GBR`, using each documented header format. All six returned 401. This establishes that this credential was not accepted by those Click & Drop requests. It does not establish which unrelated API issued it or conclusively identify the account type. No shipment, label or postage purchase was made.

The implemented calculated-price adapter is for **OLP/pay-as-you-go only**. Selecting OBA or developer portal in admin records the account type; it does not convert the credential or activate a different adapter.

## 3. Store the key privately

In the existing `.env.local`:

```dotenv
ROYAL_MAIL_API_KEY=
ROYAL_MAIL_AUTH_MODE=bearer
```

Enter the actual Click & Drop token privately after `=`. Do not include a `Bearer ` prefix, quotes or whitespace. Never prefix this setting with `NEXT_PUBLIC_`. `.env.local` remains ignored; the blank `.env.example` is intentionally tracked.

In Vercel > this project > Settings > Environment Variables, add the same two variables in **Production**, then redeploy. Restart the local server after local edits. Keep payment/email/Supabase settings unchanged. Set `ROYAL_MAIL_AUTH_MODE=raw` only if the key's documented integration specifically requires the raw Authorization header. Both modes are supported explicitly; the checkout does not repeatedly try multiple headers.

The API key is used only by server code and the explicit local diagnostic, never by a browser request to Royal Mail. Keep real carrier keys out of isolated test fixtures and preview deployments.

## 4. Check access without buying postage

Locally: `npm.cmd run check:shipping`.

Deployed: sign in as owner with MFA, then Admin > Overview > **Check Royal Mail read access**. The route is `/api/admin/shipping/readiness?royalMail=read`.

The diagnostic performs one GET to the fixed official OLP discovery URL and returns sanitised status/counts. It does not create orders or show secrets, raw provider errors or prices. Without the query, it checks configuration only.

- `configured=true` means token syntax is present, not that it authenticates.
- `connection=passed` and `pricingAccess=passed` mean priced Royal Mail service data was returned.
- 401: authentication not accepted; confirm token source/re-copy with the client.
- 403: OLP service access is not available for that key/account.
- 429: rate limited; wait and retry.
- `checkoutRates=not_checked`: this diagnostic does not assess published checkout activation or verify the fee charged.
- `shipments=not_implemented`: automatic fulfilment is not part of this pricing adapter.

Do not enable calculated pricing while the probe fails. You can keep the admin fixed fee/free-delivery settings in use.

## 5. Enter measured values in admin

Open **Admin > Store settings > Royal Mail & parcel setup**. These are editable; no estimated garment weights were inserted.

1. Keep **Delivery calculation = Admin fixed delivery fee** while preparing the setup.
2. Select the confirmed account type.
3. Enter the actual **dispatch postcode**. The OLP pricing endpoint itself accepts the recipient postcode; the dispatch postcode is retained privately for fulfilment preparation, not sent as an unsupported rate parameter.
4. Weigh the empty packaging in **grams**. Zero is allowed only if actually correct.
5. Measure the packed parcel **length, width and height in centimetres**. The database stores integer millimetres. Confirm the same measured packaging accommodates the order; it is not an automatic carton-sizing system.
6. Set the maximum number of abayas that fit this one parcel. Orders exceeding that capacity or Royal Mail's size/weight limits are blocked for a separate delivery arrangement. Multiple parcels are not silently fabricated.
7. Expand each product under **Garment weight by size** and enter its actual weight in grams, excluding packaging. Enter a weight for every size you want to sell through calculated delivery. New/recreated variants need their own saved weight.
8. Set standard and, if offered, express service codes from the account's available Royal Mail services. Do not assume the display name "Tracked 48" is the API code. Once the key works, the developer can inspect the account's read-only service response and confirm the matching code, format and weight band. No service code has been guessed.
9. Verify whether the carrier's `cost` already includes VAT or needs `vatCost` added, by comparing the API result with the client's own Click & Drop quote. Select the matching **Royal Mail price interpretation**. Leave **Not verified yet** until this is established. The store's zero added product tax does not automatically remove carrier VAT or establish the meaning of `cost`.
10. If offering express, also enable it under the existing delivery policy settings and confirm its service/aim. Express is charged separately from complimentary standard delivery.
11. **Save draft** keeps changes private. **Save & update store** publishes them. The owner can prepare and save blank/incomplete measurements in fixed mode. Publishing carrier mode requires the general setup fields; an individual basket still requires confirmed weights for its actual variants.

Only the calculation mode is exposed in the public CMS document. Dispatch postcode, dimensions and garment weights remain private. Editors cannot change these shipping settings.

## 6. Enable and compare checkout pricing

After access, inputs, codes and price interpretation are confirmed:

1. Select **Royal Mail pay-as-you-go prices** and click **Save & update store**.
2. On the storefront, add a measured size and enter a valid UK delivery address at checkout.
3. Click **Review your details**. The backend combines garment quantities/weights and packaging, checks the confirmed parcel size/capacity, then requests the configured service for that destination postcode, weight and format.
4. Compare the displayed delivery price with the client's Click & Drop price for the exact same parcel/service/postcode. Check standard, express if enabled, below threshold and exactly at threshold.
5. The displayed quote is signed, bound to that checkout's bag/address/settings and valid for five minutes. Edited/expired quotes require a fresh review. Stripe receives the verified final merchandise plus delivery total; browser-supplied prices cannot override it.
6. Missing measurements, unsuitable parcels, ambiguous/unavailable services, provider failures and missing keys block payment for that selection. They never silently become zero/free postage. There is no automatic fixed-fee fallback in carrier mode.
7. To roll back, select **Admin fixed delivery fee**, confirm the approved fee and publish. Existing opened orders keep their frozen totals and payment recovery continues normally.

Royal Mail rate requests are GETs only: country, recipient postcode, weight and package format are sent for pricing, without a name/email/full address. No postage is purchased. The privacy page discloses this. Requests use bounded bodies, a timeout, fixed-host redirects disabled, shared database quotas and sanitised errors.

## 7. Free delivery and banner

The existing **Shipping & order settings** panel controls the complimentary standard offer, merchandise threshold and fixed fallback configuration. Exactly the threshold qualifies (`subtotal >= threshold`), default GBP 80. In carrier mode, a qualifying customer pays GBP 0 standard delivery while the actual Royal Mail quote is retained separately in the order snapshot. The business still pays postage. Express upgrades stay charged.

Edit **Banner message** in Store settings. `{threshold}` inserts the configured amount. **Use automatic delivery message** restores matching free-delivery wording, or delivery-information wording when the offer is disabled. A custom message remains your responsibility to keep accurate. See [DELIVERY_SETTINGS.md](DELIVERY_SETTINGS.md).

## 8. Fulfilment limitations and account differences

Royal Mail's [Click & Drop guide](https://help.parcel.royalmail.com/hc/en-gb/articles/360011462338-Integrating-with-the-Click-Drop-API) states that OLP accounts cannot retrieve labels/documents through this API. The pricing adapter does not buy labels or automatically transfer paid orders. Continue the client's manual Click & Drop fulfilment process until a separately implemented, tested fulfilment connection exists.

For an OBA account, `/services` lists service names/codes but its response does not supply contract prices. A current approved rate card or separately entitled pricing interface is needed. OBA permits documented label retrieval; it still needs durable shipment/order linkage, duplicate protection, private labels, tracking and recovery implementation. Developer-portal products need their own documented credentials/adapter. A key swap cannot erase these account restrictions.

Shopify's own [Royal Mail labels integration](https://help.shopify.com/en/manual/fulfillment/fulfilling-orders/shipping-labels/shipping-carriers/royal-mail) uses Shopify's carrier account/rates. Those negotiated rates do not automatically transfer to this separate Next.js store.

## Technical source and validation

Adapter contract: [current official Click & Drop OpenAPI](https://api.parcel.royalmail.com/doc/v1/click-and-drop-api-v1.yaml), `/services/olp` and `OlpServiceOption`. Dimensions follow the [Royal Mail UK parcel limits](https://www.royalmail.com/sending/uk). The owner must verify the real account's response and pricing interpretation before activation.

Local tests use disposable PGlite records and fixed dummy carrier/Stripe transports. They do not prove actual Royal Mail access or buy postage. See the latest development notes for the final checks. The operator must apply the new shipping migration and deploy; no hosted configuration or inventory was changed by the agent.
