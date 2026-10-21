import { test, expect } from "@playwright/test";
import { checkoutPublicCopy } from "../../src/lib/checkout/public-copy";

test("live checkout disclosures describe real orders and provider eligibility without claiming VAT exemption", () => {
  const copy = checkoutPublicCopy("live");
  expect(copy.ordering).toContain("confirmed after payment is verified");
  expect(copy.methods).toMatch(/card payments.*Apple Pay.*Klarna.*Clearpay/);
  expect(copy.eligibility).toContain("compatible device");
  expect(copy.orderPrivacy).toContain("private order in Supabase");
  expect(copy.orderPrivacy).toContain("confirmation and the store's order notification");
  expect(copy.termsPayments).toContain("does not establish VAT registration or exemption");
  expect(copy.inactiveFeatures).not.toContain("real-money payments");
});

for (const mode of ["preview", "test"] as const) {
  test(`${mode} disclosures cannot imply a real purchase or stock reservation from reviewing a bag`, () => {
    const copy = checkoutPublicCopy(mode);
    expect(copy.ordering).toContain("Reviewing does not place an order or reserve stock");
    expect(copy.methods).toContain("No real money is charged");
    expect(copy.termsOrdering).toContain("commercial order placement are not available");
    expect(copy.orderPrivacy).toContain("Use test customer details");
  });
}
