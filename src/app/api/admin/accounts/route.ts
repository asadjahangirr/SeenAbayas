import { requireAdmin, privateJson, adminFailure } from "@/lib/admin/auth";
import { lookupAccount } from "@/lib/admin/accounts";
export async function GET() {
  try {
    const { client, user, role, passwordOnly } = await requireAdmin();
    const identity = passwordOnly ? await lookupAccount(user.email || "") : null;
    const result = role === "owner" && passwordOnly ? await client.rpc("admin_account_team") : null;
    return privateJson({ passwordOnly, username: identity?.username || null,
      email: user.email?.endsWith("@admin.invalid") ? null : user.email,
      emailVerified: Boolean(user.email_confirmed_at && !user.email?.endsWith("@admin.invalid")),
      team: result?.error ? [] : result?.data || [] });
  } catch (error) { return adminFailure(error); }
}
