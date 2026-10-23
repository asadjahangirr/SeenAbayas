import "server-only";
import { probeRoyalMailOlp, royalMailConfiguration } from "./royal-mail-probe.mjs";

export function royalMailSetupStatus() {
  return { ...royalMailConfiguration(process.env.ROYAL_MAIL_API_KEY),
    connection: "not_checked", pricingAccess: "not_checked", checkoutRates: "not_checked", shipments: "not_implemented" };
}

export function royalMailReadAccess() {
  return probeRoyalMailOlp(process.env.ROYAL_MAIL_API_KEY, fetch, process.env.ROYAL_MAIL_AUTH_MODE === "raw" ? "raw" : "bearer");
}
