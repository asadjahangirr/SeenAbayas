import { z } from "zod";
import { AdminError, adminFailure, privateJson, requireAdmin } from "@/lib/admin/auth";
import { orderEmailConfiguration, type EmailStatus } from "@/lib/order-emails/model";
import { paymentRpc } from "@/lib/payments/server";

/** Read-only: no sends, leases, provider calls or customer addresses in this response. */
export async function GET(request: Request) {
  try {
    const { role } = await requireAdmin();
    if (role !== "owner") throw new AdminError("Only the owner can inspect order emails.", 403);
    const value = new URL(request.url).searchParams.get("order");
    if (value && !z.uuid().safeParse(value).success) throw new AdminError("Invalid order reference.", 400);
    const { config, issues } = orderEmailConfiguration(process.env);
    try {
      const status = await paymentRpc<EmailStatus>("order_email_status", { target_order: value || null });
      return privateJson({ configured: Boolean(config), issues, database: "ready", ...status });
    } catch {
      return privateJson({ configured: Boolean(config), issues, database: "unavailable", ready: false, messages: [], counts: {} });
    }
  } catch (error) { return adminFailure(error); }
}
