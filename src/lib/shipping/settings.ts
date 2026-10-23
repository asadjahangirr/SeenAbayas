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
export function parcelForBag(settings: ShippingSettings, bag: BagQuote) {
  if (missingShippingSettings(settings).length) throw new ShippingError("Delivery is being configured. Please contact customer care.");
  let weight = settings.packagingWeightGrams!;
  let quantity = 0;
  for (const line of bag.lines) {
    const itemWeight = settings.variantWeights[line.variantId];
    if (!line.piece || line.issue || !itemWeight) throw new ShippingError("Delivery measurements for this selection are not confirmed. Please contact customer care.");
    quantity += line.quantity;
    weight += itemWeight * line.quantity;
  }
  if (!quantity || quantity > settings.maxItemsPerParcel!) throw new ShippingError("This selection needs a separate delivery arrangement. Please contact customer care.");
  // Dimensions are stored as integer mm, entered as cm in admin. See official UK size guide.
  const dimensions = [settings.lengthMm!, settings.widthMm!, settings.heightMm!].sort((a,b) => b-a);
  const limits = settings.packageFormat === "SmallParcel" ? [450,350,160] : [610,460,460];
  const maximumWeight = settings.packageFormat === "SmallParcel" ? 2000 : 20000;
  if (dimensions.some((value, i) => value > limits[i]) || weight > maximumWeight)
    throw new ShippingError("This selection exceeds the configured parcel size. Please contact customer care.");
  return { weightInGrams: weight, packageFormat: settings.packageFormat, quantity };
}

/** Decimal carrier amounts are pounds; reject fractions of a penny, never silently round them. */
export function carrierPence(amount: number) {
  const pence = Math.round(amount * 100);
  if (!Number.isFinite(amount) || pence < 0 || pence > 99999999 || Math.abs(amount * 100 - pence) > 0.000001)
    throw new ShippingError("The delivery provider returned an unsupported price.");
  return pence;
}
