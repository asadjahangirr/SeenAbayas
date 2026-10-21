import { AdminError, adminFailure, privateJson, requireAdmin } from "@/lib/admin/auth";
import { getPaymentSetupStatus } from "@/lib/payments/readiness";

export async function GET() {
  try {
    const { role } = await requireAdmin();
    if (role !== "owner") throw new AdminError("Only the owner can inspect payment setup.", 403);
    return privateJson(await getPaymentSetupStatus());
  } catch (error) {
    return adminFailure(error);
  }
}
