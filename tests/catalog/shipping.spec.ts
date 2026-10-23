import { test, expect } from "@playwright/test";
import { defaultDocument, siteDocumentSchema } from "../../src/lib/cms/model";
import { shippingSettingsSchema, parcelForBag, carrierPence, missingShippingSettings } from "../../src/lib/shipping/settings";
import { royalMailRate } from "../../src/lib/shipping/rates";
import { shippingInputHash, signShippingQuote, verifyShippingQuote } from "../../src/lib/shipping/quote-token";
import { documentRequestSchema } from "../../src/lib/admin/model";
import type { BagQuote } from "../../src/lib/bag/model";
import { checkoutDetailsSchema } from "../../src/lib/checkout/model";

const variant = "20000000-0000-4000-8000-000000000001";
const settings = () => shippingSettingsSchema.parse({ mode: "royal_mail_olp", accountType: "olp", dispatchPostcode: "SW1A 1AA", packagingWeightGrams: 100,
  lengthMm: 300, widthMm: 200, heightMm: 100, maxItemsPerParcel: 2, standardServiceCode: "TEST48", expressServiceCode: "TEST24", priceBasis: "cost_plus_vat", variantWeights: { [variant]: 400 } });
const bag = (): BagQuote => ({ subtotalPence: 7500, freeDelivery: false, lines: [{ variantId: variant, quantity: 1, issue: null, piece: {
  id: "design-01", name: "TEST garment", size: "54", pricePence: 7500, photo: { src: "/images/products/design-01/front.webp", alt: "Test image", label: "Front" },
} }] });
const details = checkoutDetailsSchema.parse({ email: "test@example.test", firstName: "Test", lastName: "Shopper", phone: "", addressLine1: "1 Test Street", addressLine2: "", city: "London", postcode: "SW1A1AA", country: "GB" });
const service = { brand: "RoyalMail", serviceCode: "TEST48", serviceName: "Tracked 48", packageFormat: "SmallParcel", minWeightGrams: 1, maxWeightGrams: 2000, cost: 3.54, vatCost: 0.71 };
const credentials = { key: "ROYAL_MAIL_LOCAL_FIXTURE_ONLY" };

test("old documents default to fixed fees with genuinely blank measurements", () => {
  const { shipping: _unused, ...old } = defaultDocument;
  const parsed = siteDocumentSchema.parse(old);
  expect(parsed.shipping).toMatchObject({ mode: "fixed", packagingWeightGrams: null, lengthMm: null, variantWeights: {} });
  expect(missingShippingSettings(parsed.shipping).length).toBeGreaterThan(0);
  expect(documentRequestSchema.safeParse({ document: { ...defaultDocument, shipping: { ...parsed.shipping, mode: "royal_mail_olp" } }, version: 0, publish: true }).success).toBe(false);
});
test("confirmed variant and packaging weights are summed; missing measurements and oversized selections are blocked", () => {
  expect(parcelForBag(settings(), bag())).toEqual({ weightInGrams: 500, packageFormat: "SmallParcel", quantity: 1 });
  const pair = bag(); pair.lines[0].quantity = 2;
  expect(parcelForBag(settings(), pair).weightInGrams).toBe(900);
  expect(() => parcelForBag({ ...settings(), variantWeights: {} }, bag())).toThrow("not confirmed");
  expect(() => parcelForBag({ ...settings(), lengthMm: 451 }, bag())).toThrow("exceeds");
  expect(() => parcelForBag({ ...settings(), variantWeights: { [variant]: 2000 } }, bag())).toThrow("exceeds");
  pair.lines[0].quantity = 3; expect(() => parcelForBag(settings(), pair)).toThrow("separate");
});
test("carrier quote is a fixed-host GET for the actual postcode, weight and format, with integer-pence totals", async () => {
  const quote = await royalMailRate(settings(), parcelForBag(settings(), bag()), details.postcode, "standard", false, credentials, async (url, init) => {
    const parsed = new URL(String(url)); expect(parsed.origin).toBe("https://api.parcel.royalmail.com");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ country: "GBR", postcode: "SW1A 1AA", weight: "500", packageFormat: "SmallParcel" });
    expect(init).toMatchObject({ method: "GET", cache: "no-store", redirect: "error" }); expect(init?.body).toBeUndefined();
    return Response.json({ services: [service] });
  });
  expect(quote).toMatchObject({ chargePence: 425, carrierCostPence: 425, serviceCode: "TEST48", weightInGrams: 500 });
});
test("price-basis choice avoids double carrier VAT and a waived standard fee preserves actual postage cost", async () => {
  const fake: typeof fetch = async () => Response.json({ services: [service] });
  expect((await royalMailRate({ ...settings(), priceBasis: "cost_includes_vat" }, parcelForBag(settings(), bag()), details.postcode, "standard", false, credentials, fake)).chargePence).toBe(354);
  expect(await royalMailRate(settings(), parcelForBag(settings(), bag()), details.postcode, "standard", true, credentials, fake)).toMatchObject({ chargePence: 0, carrierCostPence: 425 });
  expect(() => carrierPence(4.259)).toThrow(); expect(carrierPence(3.54)).toBe(354);
});
test("ambiguous, wrong-carrier and unavailable rates never become free shipping", async () => {
  for (const services of [[service, service], [{ ...service, brand: "Parcelforce" }], [{ ...service, maxWeightGrams: 499 }], []]) {
    await expect(royalMailRate(settings(), parcelForBag(settings(), bag()), details.postcode, "standard", true, credentials, async () => Response.json({ services }))).rejects.toThrow("unavailable");
  }
});
test("raw authentication is explicit and failures are sanitised without exposing upstream credentials", async () => {
  await expect(royalMailRate(settings(), parcelForBag(settings(), bag()), details.postcode, "standard", false, { ...credentials, authMode: "raw" }, async (_url, init) => {
    expect((init?.headers as Record<string,string>).Authorization).toBe(credentials.key);
    return new Response(`PRIVATE ${credentials.key}`, { status: 401 });
  })).rejects.toThrow("could not return a delivery price");
});
test("signed quotes bind owner, address, quantities, settings and expiry and reject modified prices", async () => {
  const quote = await royalMailRate(settings(), parcelForBag(settings(), bag()), details.postcode, "standard", false, credentials, async () => Response.json({ services: [service] }));
  const secret = "test-signing-secret-never-used-in-production";
  const input = shippingInputHash(defaultDocument, settings(), bag(), details, "standard", "a".repeat(64));
  const token = signShippingQuote(input, quote, secret);
  expect(verifyShippingQuote(token, input, secret)).toEqual(quote);
  expect(() => verifyShippingQuote(token, input, secret, quote.expiresAt)).toThrow("expired");
  for (const changed of [shippingInputHash(defaultDocument, settings(), bag(), details, "standard", "b".repeat(64)), shippingInputHash(defaultDocument, { ...settings(), packagingWeightGrams: 200 }, bag(), details, "standard", "a".repeat(64))])
    expect(() => verifyShippingQuote(token, changed, secret)).toThrow("changed");
  const [body, signature] = token.split("."); const forged = JSON.parse(Buffer.from(body,"base64url").toString()); forged.delivery.chargePence=1;
  expect(() => verifyShippingQuote(`${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`, input, secret)).toThrow("changed");
});
