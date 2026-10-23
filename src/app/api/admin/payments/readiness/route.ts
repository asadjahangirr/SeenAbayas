import { AdminError, adminFailure, privateJson, requireAdmin } from "@/lib/admin/auth";
import { getPaymentSetupStatus, getStripeReadAccess } from "@/lib/payments/readiness";

export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const { mainAdmin } = await requireAdmin();
    if (!mainAdmin) throw new AdminError("Only the owner can inspect payment setup.", 403);
    const report = await getPaymentSetupStatus();
    if (new URL(request.url).searchParams.get("stripe") === "read" && report.readyMode) {
      return privateJson({
        ...report,
        providerPermissions: "read_checks_completed",
        providerAccess: await getStripeReadAccess(report.readyMode),
      });
    }
    return privateJson(report);
  } catch (error) {
    return adminFailure(error);
  }
}
