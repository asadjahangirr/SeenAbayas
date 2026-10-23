import { z } from "zod";
import type { BagQuote } from "@/lib/bag/model";

const measurement = z.number().int().min(1).max(2000).nullable();
export const shippingSettingsSchema = z.object({
  mode: z.enum(["fixed", "royal_mail_olp"]).default("fixed"),
  accountType: z.enum(["unknown", "olp", "oba", "developer_portal"]).default("unknown"),
  dispatchPostcode: z.string().trim().max(12).default(""),
  packagingWeightGrams: z.number().int().min(0).max(20000).nullable().default(null),
  lengthMm: measurement.default(null), widthMm: measurement.default(null), heightMm: measurement.default(null),
  packageFormat: z.enum(["SmallParcel", "MediumParcel"]).default("SmallParcel"),
  maxItemsPerParcel: z.number().int().min(1).max(200).nullable().default(null),
  standardServiceCode: z.string().trim().max(30).regex(/^[A-Za-z0-9_-]*$/).default(""),
  expressServiceCode: z.string().trim().max(30).regex(/^[A-Za-z0-9_-]*$/).default(""),
  priceBasis: z.enum(["unconfirmed", "cost_includes_vat", "cost_plus_vat"]).default("unconfirmed"),
  variantWeights: z.record(z.uuid(), z.number().int().min(1).max(20000)).default({})
    .refine(value => Object.keys(value).length <= 5000, "Too many size weights."),
}).strict();
export type ShippingSettings = z.infer<typeof shippingSettingsSchema>;
export const defaultShippingSettings = shippingSettingsSchema.parse({});

export class ShippingError extends Error {
  constructor(message: string, public status = 503) { super(message); this.name = "ShippingError"; }
}
export function missingShippingSettings(settings: ShippingSettings) {
  const missing: string[] = [];
  if (settings.accountType !== "olp") missing.push("pay-as-you-go Click & Drop account");
  if (!/^(?:GIR\s?0AA|[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i.test(settings.dispatchPostcode)) missing.push("dispatch postcode");
  const measurements = { packagingWeightGrams: "packaging weight", lengthMm: "parcel length", widthMm: "parcel width", heightMm: "parcel height", maxItemsPerParcel: "parcel capacity" } as const;
  for (const field of Object.keys(measurements) as (keyof typeof measurements)[])
    if (settings[field] === null) missing.push(measurements[field]);
  if (!settings.standardServiceCode) missing.push("standard service code");
  if (settings.priceBasis === "unconfirmed") missing.push("carrier price/VAT basis");
  return missing;
}
export type ShippingParcel = { weightInGrams: number; packageFormat: ShippingSettings["packageFormat"]; quantity: number };
export const maximumShippingParcels = 20;

/** Pack measured garments into the configured packaging; capacity applies per parcel. */
export function parcelsForBag(settings: ShippingSettings, bag: BagQuote): ShippingParcel[] {
  if (missingShippingSettings(settings).length) throw new ShippingError("Delivery is being configured. Please contact customer care.");
  // Dimensions are stored as integer mm, entered as cm in admin. See official UK size guide.
  const dimensions = [settings.lengthMm!, settings.widthMm!, settings.heightMm!].sort((a,b) => b-a);
  const limits = settings.packageFormat === "SmallParcel" ? [450,350,160] : [610,460,460];
  const maximumWeight = settings.packageFormat === "SmallParcel" ? 2000 : 20000;
  if (dimensions.some((value, i) => value > limits[i]))
    throw new ShippingError("This selection exceeds the configured parcel size. Please contact customer care.");
  const parcels: ShippingParcel[] = [];
  // Stable first-fit decreasing order also runs inside the transactional SQL check.
  const lines = [...bag.lines].sort((a,b) => (settings.variantWeights[b.variantId] || 0) - (settings.variantWeights[a.variantId] || 0)
    || (a.variantId < b.variantId ? -1 : a.variantId > b.variantId ? 1 : 0));
  for (const line of lines) {
    const itemWeight = settings.variantWeights[line.variantId];
    if (!line.piece || line.issue || !itemWeight) throw new ShippingError("Delivery measurements for this selection are not confirmed. Please contact customer care.");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 10) throw new ShippingError("Please review the quantities in your bag.", 400);
    if (itemWeight + settings.packagingWeightGrams! > maximumWeight)
      throw new ShippingError("This selection exceeds the configured parcel size. Please contact customer care.");
    for (let unit=0; unit<line.quantity; unit++) {
      let parcel = parcels.find(p => p.quantity < settings.maxItemsPerParcel! && p.weightInGrams + itemWeight <= maximumWeight);
      if (!parcel) {
        if (parcels.length >= maximumShippingParcels) throw new ShippingError("This large order needs a separate delivery arrangement. Please contact customer care.");
        parcel = { weightInGrams: settings.packagingWeightGrams!, packageFormat: settings.packageFormat, quantity: 0 };
        parcels.push(parcel);
      }
      parcel.weightInGrams += itemWeight;
      parcel.quantity++;
    }
  }
  if (!parcels.length) throw new ShippingError("Add an available piece to your bag first.", 400);
  return parcels;
}

/** Retained for consumers explicitly requesting one parcel. Checkout uses parcelsForBag. */
export function parcelForBag(settings: ShippingSettings, bag: BagQuote) {
  const parcels = parcelsForBag(settings, bag);
  if (parcels.length !== 1) throw new ShippingError("This selection needs a separate delivery arrangement. Please contact customer care.");
  return parcels[0];
}

/** Decimal carrier amounts are pounds; reject fractions of a penny, never silently round them. */
export function carrierPence(amount: number) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || pence < 0 || pence > 99999999 || Math.abs(amount * 100 - pence) > 0.000001)
    throw new ShippingError("The delivery provider returned an unsupported price.");
  return pence;
}
