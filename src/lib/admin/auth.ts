import "server-only";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { environment } from "@/lib/environment";

export class AdminError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function adminClient() {
  const url = environment.catalog.supabase?.url;
  const key = environment.catalog.supabase?.publishableKey;
  if (!url || !key)
    throw new AdminError("Configure Supabase before signing in.", 503);
  const jar = await cookies();
  const localHost = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
    (await headers()).get("host") || "",
  );
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !localHost,
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          try {
            jar.set(name, value, options);
          } catch {
            /* Proxy refreshes cookies for Server Components. */
          }
        }
      },
    },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)])
            : AbortSignal.timeout(10000),
        }),
    },
  });
}
export async function requireAdmin(requireMfa = true) {
  const client = await adminClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new AdminError("Please sign in.", 401);
  const access = await client.rpc("admin_access");
  if (access.error)
    throw new AdminError(
      "Apply the administration migrations before signing in.",
      503,
    );
  if (!access.data?.allowed)
    throw new AdminError("This account has no administration access.", 403);
  if (requireMfa && !access.data.mfa)
    throw new AdminError("Verify your authenticator code.", 403);
  return {
    client,
    user: data.user,
    role: access.data.role as "owner" | "editor",
    mfa: Boolean(access.data.mfa),
  };
}

// Share the verified read context only within a Server Component render.
// Mutation handlers keep using requireAdmin directly for fresh checks.
export const getAdminRenderAccess = cache(() => requireAdmin());
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    const source = new URL(origin || "");
    // Next may normalize the internal request URL to localhost. Compare the
    // incoming Host (including port), without trusting forwarded headers.
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.host !== request.headers.get("host") ||
      request.headers.get("sec-fetch-site") === "cross-site"
    )
      throw new Error();
    if (
      process.env.NODE_ENV === "production" &&
      source.protocol !== "https:" &&
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(source.host)
    )
      throw new Error();
  } catch {
    throw new AdminError("Refresh the page and try again.", 403);
  }
}
export async function readAdminBody(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new AdminError("Use a JSON request.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AdminError("A request body is required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 524288) {
      await reader.cancel();
      throw new AdminError("Request is too large.", 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AdminError("Invalid request.");
  }
}
export const privateJson = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export function adminFailure(error: unknown) {
  return privateJson(
    {
      error:
        error instanceof AdminError
          ? error.message
          : "The request could not be completed. Please reload and try again.",
    },
    error instanceof AdminError ? error.status : 503,
  );
}
