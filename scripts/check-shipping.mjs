// Explicit read-only diagnostic. Never creates orders, labels, manifests or purchases.
import fs from "node:fs";
import { probeRoyalMailOlp } from "../src/lib/shipping/royal-mail-probe.mjs";
if (fs.existsSync(".env.local")) process.loadEnvFile(".env.local");
const report = await probeRoyalMailOlp(process.env.ROYAL_MAIL_API_KEY, fetch, process.env.ROYAL_MAIL_AUTH_MODE === "raw" ? "raw" : "bearer");
console.log(JSON.stringify(report, null, 2));
if (report.connection !== "passed" || report.pricingAccess !== "passed") process.exitCode = 1;
