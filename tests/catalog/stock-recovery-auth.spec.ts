import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { recoveryAuthorised } from "../../src/lib/payments/recovery-auth";

const secret = "isolated-stock-recovery-test-secret-123456";
const now = 1_792_500_000_000;
function signed(seconds = Math.floor(now / 1000), key = secret) {
  const stamp = String(seconds);
  return new Headers({
    "x-seen-recovery-timestamp": stamp,
    "x-seen-recovery-signature": createHmac("sha256", key).update(`seen-stock-recovery:v1:${stamp}:POST:/api/payments/reconcile`).digest("hex"),
  });
}
test("recovery accepts only the configured capability and never an empty or short secret", () => {
  expect(recoveryAuthorised(new Headers({Authorization:`Bearer ${secret}`}),"GET",secret,now)).toBe(true);
  for(const key of [undefined,"", "short", "x".repeat(257)]) expect(recoveryAuthorised(new Headers(),"POST",key,now)).toBe(false);
  expect(recoveryAuthorised(new Headers({Authorization:`Bearer ${secret}extra`}),"POST",secret,now)).toBe(false);
});
test("queued recovery proofs are short-lived, method-bound and reject tampering", () => {
  expect(recoveryAuthorised(signed(),"POST",secret,now)).toBe(true);
  expect(recoveryAuthorised(signed(),"GET",secret,now)).toBe(false);
  expect(recoveryAuthorised(signed(Math.floor(now/1000)-301),"POST",secret,now)).toBe(false);
  expect(recoveryAuthorised(signed(Math.floor(now/1000)+301),"POST",secret,now)).toBe(false);
  expect(recoveryAuthorised(signed(Math.floor(now/1000),"wrong-key"),"POST",secret,now)).toBe(false);
  const malformed=signed();malformed.set("x-seen-recovery-signature","non-hex");
  expect(recoveryAuthorised(malformed,"POST",secret,now)).toBe(false);
});
