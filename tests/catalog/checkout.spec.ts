import { test, expect } from "@playwright/test";
import {
  checkoutDetailsSchema,
  checkoutReviewRequestSchema,
  checkoutDeliveryOptions,
  makeCheckoutReview,
} from "../../src/lib/checkout/model";
import { defaultDocument, announcementTextFor } from "../../src/lib/cms/model";
import { summarizeBag } from "../../src/lib/bag/model";
import { collectionPieces } from "../../src/data/collection";

const details = {
  email: "shopper@example.test",
  firstName: "Test",
  lastName: "Shopper",
  phone: "",
  addressLine1: "1 Test Street",
  addressLine2: "",
  city: "London",
  postcode: "sw1a1aa",
  country: "GB",
};
const variantId = "20000000-0000-4000-8000-000000000001";
function bag(pricePence: number) {
  return summarizeBag([
    {
      variantId,
      quantity: 1,
      issue: null,
      piece: {
        id: "design-01",
        name: "TEST ONLY",
        size: "54",
        pricePence,
        photo: collectionPieces[0].photos[0],
      },
    },
  ]);
}

test("checkout normalises UK postcode formatting and accepts optional phone/address line", () => {
  expect(checkoutDetailsSchema.parse(details)).toMatchObject({
    postcode: "SW1A 1AA",
    phone: "",
    addressLine2: "",
  });
  expect(
    checkoutDetailsSchema.parse({
      ...details,
      postcode: "bt1 1aa",
      firstName: "Élodie",
    }).postcode,
  ).toBe("BT1 1AA");
  for (const invalid of [
    { ...details, postcode: "invalid" },
    { ...details, country: "FR" },
    { ...details, postcode: "JE1 1AA" },
    { ...details, email: "wrong" },
    { ...details, firstName: "  " },
    { ...details, phone: "abc" },
    { ...details, lastName: "x".repeat(81) },
  ])
    expect(checkoutDetailsSchema.safeParse(invalid).success).toBe(false);
});

test("checkout rejects caller prices, invalid quantities, duplicate variants and extra fields", () => {
  const valid = {
    details,
    shippingMethod: "standard",
    lines: [{ variantId, quantity: 1 }],
  };
  expect(checkoutReviewRequestSchema.safeParse(valid).success).toBe(true);
  for (const invalid of [
    { ...valid, subtotalPence: 1 },
    { ...valid, lines: [{ variantId, quantity: 1, pricePence: 1 }] },
    { ...valid, lines: [] },
    { ...valid, lines: [{ variantId, quantity: 11 }] },
    { ...valid, lines: [...valid.lines, ...valid.lines] },
    { ...valid, shippingMethod: "invented" },
  ])
    expect(checkoutReviewRequestSchema.safeParse(invalid).success).toBe(false);
});

test("free standard delivery includes the threshold without inventing lower-order rates or VAT", () => {
  const parsed = checkoutDetailsSchema.parse(details);
  const lower = makeCheckoutReview(
    defaultDocument,
    bag(7999),
    parsed,
    "standard",
  );
  expect(lower.delivery.chargePence).toBeNull();
  expect(lower.estimatedTotalPence).toBeNull();
  const exact = makeCheckoutReview(
    defaultDocument,
    bag(8000),
    parsed,
    "standard",
  );
  expect(exact).toMatchObject({
    estimatedTotalPence: 8000,
    paymentAvailable: false,
    taxStatus: "unconfirmed",
    mode: "preview",
  });
  expect(exact.delivery.chargePence).toBe(0);
  expect(
    makeCheckoutReview(defaultDocument, bag(8001), parsed, "standard").delivery
      .chargePence,
  ).toBe(0);
  expect(checkoutDeliveryOptions(defaultDocument, bag(8000))).toHaveLength(1);
});

test("configured rates and minimums apply; unavailable shipping and stock are rejected", () => {
  const document = structuredClone(defaultDocument);
  const policies = document.policies as {
    delivery: {
      standardChargePence: number | null;
      expressAvailable: boolean | null;
      expressChargePence: number | null;
    };
  };
  policies.delivery.standardChargePence = 450;
  policies.delivery.expressAvailable = true;
  policies.delivery.expressChargePence = 700;
  const parsed = checkoutDetailsSchema.parse(details);
  expect(
    makeCheckoutReview(document, bag(7500), parsed, "standard")
      .estimatedTotalPence,
  ).toBe(7950);
  expect(
    makeCheckoutReview(document, bag(8000), parsed, "express")
      .estimatedTotalPence,
  ).toBe(8700);
  expect(() =>
    makeCheckoutReview(defaultDocument, bag(8000), parsed, "express"),
  ).toThrow("no longer available");
  const unavailable = bag(8000);
  unavailable.lines[0].issue = "insufficient-stock";
  expect(() =>
    makeCheckoutReview(document, unavailable, parsed, "standard"),
  ).toThrow("unavailable items");
  document.commerce.minimumOrderPence = 9000;
  expect(() =>
    makeCheckoutReview(document, bag(8000), parsed, "standard"),
  ).toThrow("minimum");
});

test("legacy stock announcement follows the new inclusive rule and custom messages are preserved", () => {
  const document = structuredClone(defaultDocument);
  document.announcement.text =
    "Complimentary UK delivery on orders over {threshold}";
  expect(announcementTextFor(document)).toBe(
    "Complimentary UK delivery on orders of £80 or more",
  );
  document.announcement.text = "A new collection awaits.";
  expect(announcementTextFor(document)).toBe("A new collection awaits.");
});

test("automatic banner stops advertising free delivery when the offer is disabled", () => {
  const document = structuredClone(defaultDocument);
  document.commerce.freeDeliveryThresholdPence = 7250;
  expect(announcementTextFor(document)).toContain("£72.5 or more");
  document.commerce.freeDeliveryEnabled = false;
  expect(announcementTextFor(document)).toBe("UK delivery available. View delivery information.");
  document.announcement.text = "Our new edit is here.";
  expect(announcementTextFor(document)).toBe("Our new edit is here.");
});
