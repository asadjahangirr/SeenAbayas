import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { SiteDocument } from "@/lib/cms/model";
import type { BagQuote } from "@/lib/bag/model";
import type { CheckoutDetails } from "@/lib/checkout/model";
import { ShippingError, type ShippingSettings } from "./settings";
import type { CarrierDelivery } from "./rates";

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function shippingInputHash(document: SiteDocument, settings: ShippingSettings, bag: BagQuote, details: CheckoutDetails, method: string, ownerHash: string) {
  return digest({ ownerHash, method, details, commerce: document.commerce, delivery: document.policies,
    settings, lines: [...bag.lines].map(line => ({ id: line.variantId, quantity: line.quantity, price: line.piece?.pricePence })).sort((a,b) => a.id.localeCompare(b.id)) });
}
const schema = z.object({ inputHash: z.string().regex(/^[a-f0-9]{64}$/), delivery: z.object({
  id: z.enum(["standard", "express"]), label: z.string().min(1).max(150), carrier: z.literal("Royal Mail"), source: z.literal("royal_mail_olp"),
  serviceCode: z.string().min(1).max(30), chargePence: z.number().int().min(0).max(99999999), carrierCostPence: z.number().int().min(0).max(99999999),
  weightInGrams: z.number().int().min(1).max(400000), packageFormat: z.enum(["SmallParcel", "MediumParcel"]), expiresAt: z.number().int(),
  parcels: z.array(z.object({ weightInGrams: z.number().int().min(1).max(20000), quantity: z.number().int().min(1).max(200),
    carrierCostPence: z.number().int().min(0).max(99999999) }).strict()).min(2).max(20).optional(),
}).strict() }).strict();
function proof(body: string, secret: string) { return createHmac("sha256", secret).update(`seen-shipping-quote:v1:${body}`).digest(); }
export function signShippingQuote(inputHash: string, delivery: CarrierDelivery, secret: string) {
  if (secret.length < 24) throw new ShippingError("Delivery signing is not configured.");
  const body = Buffer.from(JSON.stringify(schema.parse({ inputHash, delivery }))).toString("base64url");
  return `${body}.${proof(body, secret).toString("base64url")}`;
}
export function verifyShippingQuote(token: string | undefined, inputHash: string, secret: string, now = Date.now()) {
  try {
    if (!token || token.length > 8192 || secret.length < 24) throw Error();
    const [body, signature, extra] = token.split(".");
    if (!body || !signature || extra !== undefined) throw Error();
    const actual = Buffer.from(signature, "base64url"), expected = proof(body, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw Error();
    const parsed = schema.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8")));
    if (parsed.inputHash !== inputHash || parsed.delivery.expiresAt <= now || parsed.delivery.expiresAt > now + 5 * 60_000 + 10_000) throw Error();
    return parsed.delivery;
  } catch { throw new ShippingError("Your delivery quote expired or changed. Please review your details again.", 409); }
}
