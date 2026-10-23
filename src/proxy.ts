import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readCatalogConfig } from "@/lib/catalog/config.mjs";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64");
  const isDevelopment = process.env.NODE_ENV === "development";
  // The allowlist must survive client navigation from another page to Contact.
  // Only the Turnstile frame origin is allowed, and only when its widget is configured.
  const contactVerification = process.env.CONTACT_DELIVERY === "email" && Boolean(process.env.CONTACT_TURNSTILE_SITE_KEY);
  const isDraftPreview = request.nextUrl.pathname === "/admin/preview" || request.nextUrl.pathname.startsWith("/admin/preview/");
  const isAdmin = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/") || request.nextUrl.pathname.startsWith("/api/admin");
  const supabase = readCatalogConfig(process.env).supabase;
  let uploadOrigin = "";
  try { if (isAdmin && supabase) uploadOrigin = new URL(supabase.url).origin; } catch { /* Invalid config is reported in the admin. */ }

  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // Next/Image uses inline styles; scripts remain nonce-restricted in production.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self'",
    "font-src 'self'",
    `connect-src 'self'${uploadOrigin ? ` ${uploadOrigin}` : ""}${isDevelopment ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    isAdmin ? "frame-src 'self'" : contactVerification ? "frame-src https://challenges.cloudflare.com" : "frame-src 'none'",
    isDraftPreview ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-seen-pathname", request.nextUrl.pathname);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (isAdmin && supabase) {
    const client = createServerClient(supabase.url, supabase.publishableKey, {
      cookieOptions: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(request.headers.get("host") || ""), path: "/" },
      cookies: { getAll: () => request.cookies.getAll(), setAll: values => { for (const { name, value, options } of values) { request.cookies.set(name, value); response.cookies.set(name, value, options); } } },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000), cache: "no-store" }) },
    });
    // Refresh before rendering. API and page guards still verify membership and MFA.
    if (request.cookies.getAll().some(c => c.name.startsWith("sb-"))) { try { await client.auth.getClaims(); } catch { /* Guards show the signed-out state. */ } }
    // The forwarded Cookie header must include any refreshed tokens.
    requestHeaders.set("cookie", request.cookies.toString());
    const refreshed = NextResponse.next({ request: { headers: requestHeaders } });
    for (const cookie of response.cookies.getAll()) refreshed.cookies.set(cookie);
    refreshed.headers.set("Content-Security-Policy", policy);
    refreshed.headers.set("Cache-Control", "private, no-store");
    return refreshed;
  }
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/((?!_next/|images/|videos/|favicon.ico).*)"],
};
