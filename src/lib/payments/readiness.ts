import "server-only";
import { paymentConfigurationReport } from "./diagnostics.mjs";
import { paymentRpc } from "./server";

/** Owner-only caller. Reads configuration/health, never Stripe or commerce writes. */
export async function getPaymentSetupStatus() {
  const report = paymentConfigurationReport(process.env);
  const result = {
    ...report,
    readyMode: null as "test" | "live" | null,
    database: "not_checked",
    providerPermissions: "not_tested",
  };
  if (!report.configuredMode || report.issues.length) return result;
  try {
    const health = await paymentRpc<{ ready?: boolean; live_payments_ready?: boolean }>("payment_health");
    if (health?.ready !== true) {
      result.database = "not_ready";
      result.issues.push({ setting: "database", message: "The payment database health check did not report ready." });
    } else if (report.configuredMode === "live" && health.live_payments_ready !== true) {
      result.database = "live_migration_required";
      result.issues.push({ setting: "database", message: "The deployed project's payment_health must report live_payments_ready=true. Verify 20261021000100_live_payments.sql in that project." });
    } else {
      result.database = "ready";
      result.readyMode = report.configuredMode === "live" ? "live" : "test";
    }
  } catch {
    result.database = "unavailable";
    result.issues.push({ setting: "database", message: "The deployed server could not read payment_health. Check its Supabase project, server key and installed functions." });
  }
  return result;
}
