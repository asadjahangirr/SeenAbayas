import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { CheckoutReview } from "@/lib/checkout/model";
import type { SiteDocument } from "@/lib/cms/model";
import { paymentRpc } from "@/lib/payments/server";
import { shippingSettingsSchema, parcelsForBag, ShippingError } from "./settings";
import { royalMailRates } from "./rates";
import { shippingInputHash, signShippingQuote, verifyShippingQuote } from "./quote-token";
import { readPaymentCredentials } from "@/lib/payments/config.mjs";

/** Private parcel/origin settings never travel in the public CMS document. */
export async function privateShippingSettings() {
  const settings = await paymentRpc<unknown>("get_shipping_settings");
  return shippingSettingsSchema.parse(settings || {});
}
export async function applyCarrierQuote(review: CheckoutReview, document: SiteDocument, ownerHash: string, request: Request, token?: string) {
  const settings = await privateShippingSettings();
  if (settings.mode !== "royal_mail_olp") throw new ShippingError("Delivery settings changed. Please review again.", 409);
  const parcels = parcelsForBag(settings, review.bag);
  if (parcels.length > 1) {
    const health = await paymentRpc<{ multi_parcel_ready?: boolean }>("shipping_health");
    if (!health.multi_parcel_ready) throw new ShippingError("Multi-item delivery is being updated. Please try again shortly.");
  }
  const secret = process.env.SUPABASE_SECRET_KEY || "";
  const inputHash = shippingInputHash(document, settings, review.bag, review.details, review.delivery.id, ownerHash);
  let delivery;
  if (token) delivery = verifyShippingQuote(token, inputHash, secret);
  else {
    const candidate = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
    const network = candidate && isIP(candidate) ? candidate : "shared-unconfigured-proxy";
    const networkHash = createHmac("sha256", secret).update(`seen-shipping-rate:v1:${network}`).digest("hex");
    await paymentRpc("shipping_quote_attempt", { owner_hash: ownerHash, network_hash: networkHash });
    const fixture = readPaymentCredentials(process.env)?.fixtureOrigin;
    let transport: typeof fetch = fetch;
    if (fixture) {
      if (process.env.ROYAL_MAIL_API_KEY !== "ROYAL_MAIL_LOCAL_FIXTURE_ONLY") throw new ShippingError("Do not use a real carrier key with the local simulator.");
      transport = (input, init) => {
        const url = new URL(String(input));
        if (url.origin !== "https://api.parcel.royalmail.com" || url.pathname !== "/api/v1/services/olp") throw new ShippingError("Invalid simulator request.");
        return fetch(`${fixture}/__test/royal-mail${url.search}`, init);
      };
    }
    delivery = await royalMailRates(settings, parcels, review.details.postcode, review.delivery.id, review.bag.freeDelivery,
      { key: process.env.ROYAL_MAIL_API_KEY, authMode: process.env.ROYAL_MAIL_AUTH_MODE === "raw" ? "raw" : "bearer" }, transport);
    token = signShippingQuote(inputHash, delivery, secret);
  }
  // The signed quote is the price agreed for five minutes; session creation does not refetch/alter it.
  review.delivery = { ...delivery, deliveryAim: review.delivery.deliveryAim };
  review.estimatedTotalPence = review.bag.subtotalPence + delivery.chargePence;
  review.shippingQuote = token;
  return { settings, delivery };
}
