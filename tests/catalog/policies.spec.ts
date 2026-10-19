import { expect, test } from "@playwright/test";
import { makeCancellationForm, missingPolicySettings, policiesAreDraft, policyRobots, policySettings, type StorePolicySettings } from "../../src/lib/policies";

function reviewedFixture(): StorePolicySettings {
  return {
    review: { status: "approved", reviewedOn: "2026-10-19" },
    business: { legalName: "TEST ONLY — merchant fixture", legalForm: "sole-trader", businessAddress: "TEST ADDRESS — not a trading location", returnsAddress: "TEST RETURN ADDRESS", registrationNumber: null, vatRegistered: false, vatNumber: null, phone: null },
    delivery: { dispatchWindow: "TEST processing window", standardChargePence: 0, standardDeliveryAim: "TEST delivery aim", expressAvailable: false, expressChargePence: null, expressDeliveryAim: null, destinations: "TEST destinations", internationalAvailability: "TEST international policy" },
    privacy: { enquiryLawfulBasis: "TEST legal basis", securityLawfulBasis: "TEST security basis", enquiryRetention: "TEST retention", hostingAndLogs: "TEST hosting and logs", providersAndTransfers: "TEST providers and transfers" },
  };
}

test("unknown merchant information keeps every policy a noindex draft", () => {
  expect(policiesAreDraft).toBe(true);
  expect(policyRobots).toEqual({ index: false, follow: false });
  const missing = missingPolicySettings(policySettings);
  expect(missing).toContain("business.legalName");
  expect(missing).toContain("business.businessAddress");
  expect(missing).toContain("delivery.standardChargePence");
  expect(missing).toContain("privacy.providersAndTransfers");
  const incomplete = structuredClone(policySettings);
  incomplete.review = { status: "approved", reviewedOn: "2026-10-19" };
  expect(missingPolicySettings(incomplete).length).toBeGreaterThan(0);
});

test("readiness distinguishes unknown values from confirmed zero charges or unavailable express", () => {
  const complete = reviewedFixture();
  expect(missingPolicySettings(complete)).toEqual([]);
  complete.delivery.expressAvailable = true;
  expect(missingPolicySettings(complete)).toEqual(["delivery.expressChargePence", "delivery.expressDeliveryAim"]);
  complete.business.legalForm = "limited-company";
  complete.business.vatRegistered = true;
  expect(missingPolicySettings(complete)).toContain("business.registrationNumber");
  expect(missingPolicySettings(complete)).toContain("business.vatNumber");
});

test("cancellation form includes true merchant details or explicit unknowns and is optional", () => {
  const draft = makeCancellationForm();
  expect(draft).toContain("PREVIEW");
  expect(draft).toContain("legal trading name to be confirmed");
  expect(draft).toContain("info@seenabayas.co.uk");
  expect(draft).toContain("Signature of consumer(s) (only if notified on paper)");
  expect(draft).toContain("do not have to use this form");
  const ready = makeCancellationForm(reviewedFixture());
  expect(ready).toContain("TEST ONLY — merchant fixture");
  expect(ready).not.toContain("PREVIEW");
  expect(ready).not.toContain("to be confirmed");
});
