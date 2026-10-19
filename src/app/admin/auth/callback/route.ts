import { NextResponse } from "next/server";
import { adminClient, requireAdmin } from "@/lib/admin/auth";
export async function GET(request: Request) {
  const current = new URL(request.url);
  const code = current.searchParams.get("code");
  let path = "/admin/recover?error=link";
  if (code && code.length <= 2048) {
    try {
      const client = await adminClient();
      const result = await client.auth.exchangeCodeForSession(code);
      if (!result.error) {
        await requireAdmin(false);
        path =
          current.searchParams.get("intent") === "email"
            ? "/admin/security"
            : "/admin/recover?stage=password";
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
