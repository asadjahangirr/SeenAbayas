import { NextResponse } from "next/server";
import { adminClient, requireAdmin } from "@/lib/admin/auth";
import { cookies } from "next/headers";
import { recoveryCookie, recoveryProof, sessionIdentity } from "@/lib/admin/recovery-proof";
export async function GET(request: Request) {
  const current = new URL(request.url);
  const code = current.searchParams.get("code");
  let path = "/admin/recover?error=link";
  if (code && code.length <= 2048) {
    try {
      const client = await adminClient();
      const result = await client.auth.exchangeCodeForSession(code);
      if (!result.error) {
        const redirectType = (result.data as typeof result.data & { redirectType?: string | null }).redirectType;
        const access = await requireAdmin(false);
        if (access.passwordOnly && redirectType === "PASSWORD_RECOVERY" && result.data.session) {
          (await cookies()).set(recoveryCookie, recoveryProof(access.user.id, sessionIdentity(result.data.session.access_token), process.env.SUPABASE_SECRET_KEY || ""), {
            httpOnly:true, sameSite:"lax", secure:current.protocol === "https:", path:"/", maxAge:600,
          });
        }
        path =
          current.searchParams.get("intent") === "email"
            ? "/admin/security"
            : redirectType === "PASSWORD_RECOVERY" ? "/admin/recover?stage=password" : "/admin";
      }
    } catch {
      /* The UI offers a fresh recovery request. */
    }
  }
  const target = new URL(path, request.url);
  target.host = request.headers.get("host") || target.host;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname))
    target.protocol = "https:";
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
