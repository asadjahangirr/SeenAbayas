import { AdminError, adminFailure, privateJson, requireAdmin } from "@/lib/admin/auth";
import { royalMailReadAccess, royalMailSetupStatus } from "@/lib/shipping/royal-mail";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Owner + MFA only. The optional provider probe performs one GET, never postage writes. */
export async function GET(request: Request) {
  try {
    const { mainAdmin } = await requireAdmin();
    if (!mainAdmin) throw new AdminError("Only the owner can inspect shipping setup.", 403);
    return privateJson(new URL(request.url).searchParams.get("royalMail") === "read"
      ? await royalMailReadAccess() : royalMailSetupStatus());
  } catch (error) { return adminFailure(error); }
}
