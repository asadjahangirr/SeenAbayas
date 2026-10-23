import { z } from "zod";
import { boundedJson, royalMailConfiguration } from "./royal-mail-probe.mjs";
import { carrierPence, ShippingError, type ShippingSettings, type ShippingParcel } from "./settings";

const serviceSchema = z.object({
  brand: z.string(), serviceCode: z.string().min(1).max(30), serviceName: z.string().min(1).max(150),
  packageFormat: z.string(), minWeightGrams: z.number().int().min(0), maxWeightGrams: z.number().int().min(1),
  cost: z.number().finite().nonnegative(), vatCost: z.number().finite().nonnegative().optional(),
});
const ratesSchema = z.object({ services: z.array(z.unknown()).max(1000) });
export type CarrierDelivery = {
  id: "standard" | "express"; label: string; carrier: "Royal Mail"; chargePence: number;
  source: "royal_mail_olp"; serviceCode: string; carrierCostPence: number;
  weightInGrams: number; packageFormat: "SmallParcel" | "MediumParcel"; expiresAt: number;
  parcels?: { weightInGrams: number; quantity: number; carrierCostPence: number }[];
};

export async function royalMailRate(settings: ShippingSettings, parcel: ShippingParcel, postcode: string,
  method: "standard" | "express", freeStandard: boolean,
  credentials: { key?: string; authMode?: "bearer" | "raw" }, fetcher: typeof fetch = fetch): Promise<CarrierDelivery> {
  if (!royalMailConfiguration(credentials.key).configured) throw new ShippingError("Delivery quotes are not available yet. Please contact customer care.");
  if (!/^[A-Z0-9 ]{5,9}$/.test(postcode)) throw new ShippingError("Please check your delivery postcode.", 400);
  const serviceCode = method === "standard" ? settings.standardServiceCode : settings.expressServiceCode;
  if (!serviceCode || settings.priceBasis === "unconfirmed") throw new ShippingError("That delivery service is not configured yet.");
  const query = new URLSearchParams({ country: "GBR", postcode, weight: String(parcel.weightInGrams), packageFormat: parcel.packageFormat });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetcher(`https://api.parcel.royalmail.com/api/v1/services/olp?${query}`, {
      method: "GET", headers: { Authorization: credentials.authMode === "raw" ? credentials.key! : `Bearer ${credentials.key}`, Accept: "application/json" },
      signal: controller.signal, redirect: "error", cache: "no-store",
    });
    if (!response.ok) { await response.body?.cancel(); throw new ShippingError("Royal Mail could not return a delivery price. Please try again or contact customer care."); }
    const parsed = ratesSchema.safeParse(await boundedJson(response));
    if (!parsed.success) throw new ShippingError("The delivery provider returned an unsupported response.");
    const matches = parsed.data.services.map(value => serviceSchema.safeParse(value)).flatMap(result => result.success ? [result.data] : [])
      .filter(service => service.brand === "RoyalMail" && service.serviceCode === serviceCode && service.packageFormat === parcel.packageFormat &&
        parcel.weightInGrams >= service.minWeightGrams && parcel.weightInGrams <= service.maxWeightGrams);
    // Ambiguous choices can include extras/collection options; never silently choose a price.
    if (matches.length !== 1) throw new ShippingError("That delivery service is unavailable for this parcel or address. Please contact customer care.");
    const service = matches[0];
    if (settings.priceBasis === "cost_plus_vat" && service.vatCost === undefined) throw new ShippingError("The delivery provider did not confirm the full price.");
    const cost = carrierPence(service.cost) + (settings.priceBasis === "cost_plus_vat" ? carrierPence(service.vatCost!) : 0);
    if (cost > 99999999) throw new ShippingError("The delivery price is outside the supported range.");
    return { id: method, label: service.serviceName, carrier: "Royal Mail", source: "royal_mail_olp", serviceCode,
      chargePence: method === "standard" && freeStandard ? 0 : cost, carrierCostPence: cost,
      weightInGrams: parcel.weightInGrams, packageFormat: parcel.packageFormat, expiresAt: Date.now() + 5 * 60_000 };
  } catch (error) {
    if (error instanceof ShippingError) throw error;
    throw new ShippingError("We could not check delivery just now. Please try again.");
  } finally { clearTimeout(timer); }
}

/** Quote every parcel, reuse identical weights, and waive only the customer's standard fee. */
export async function royalMailRates(settings: ShippingSettings, parcels: ShippingParcel[], postcode: string,
  method: "standard" | "express", freeStandard: boolean,
  credentials: { key?: string; authMode?: "bearer" | "raw" }, fetcher: typeof fetch = fetch): Promise<CarrierDelivery> {
  const quotes = new Map<string, CarrierDelivery>();
  const breakdown: NonNullable<CarrierDelivery["parcels"]> = [];
  let first: CarrierDelivery | undefined;
  let lastStarted = 0;
  const deadline = Date.now() + 25_000;
  for (const parcel of parcels) {
    const key = `${parcel.packageFormat}:${parcel.weightInGrams}`;
    let quote = quotes.get(key);
    if (!quote) {
      // Click & Drop allows two requests/second. Identical parcels need one lookup.
      const delay = Math.max(0, 550 - (Date.now() - lastStarted));
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (Date.now() > deadline - 8000) throw new ShippingError("Delivery is taking longer than expected. Please try again.");
      lastStarted = Date.now();
      quote = await royalMailRate(settings, parcel, postcode, method, false, credentials, fetcher);
      quotes.set(key, quote);
    }
    first ||= quote;
    breakdown.push({ weightInGrams: parcel.weightInGrams, quantity: parcel.quantity, carrierCostPence: quote.carrierCostPence });
  }
  if (!first) throw new ShippingError("Add an available piece to your bag first.", 400);
  const cost = breakdown.reduce((total,p) => total+p.carrierCostPence,0);
  if (cost > 99999999) throw new ShippingError("The delivery price is outside the supported range.");
  return { ...first, carrierCostPence: cost, chargePence: method === "standard" && freeStandard ? 0 : cost,
    weightInGrams: breakdown.reduce((total,p) => total+p.weightInGrams,0),
    expiresAt: Math.min(...[...quotes.values()].map(q=>q.expiresAt)),
    ...(breakdown.length > 1 ? { parcels: breakdown } : {}) };
}
