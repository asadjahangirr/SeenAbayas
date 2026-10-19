import { z } from "zod";

const origin = z.url().refine((value) => {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" &&
    (url.protocol === "https:" || (local && url.protocol === "http:"));
}, "Use an HTTPS project origin, or HTTP on loopback for local development.");

const schema = z.object({
  CATALOG_SOURCE: z.enum(["preview", "development", "supabase"]).default("preview"),
  NEXT_PUBLIC_SUPABASE_URL: origin.optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/, "Use a publishable key, never a secret or service-role key.").optional(),
}).superRefine((value, context) => {
  const hasUrl = Boolean(value.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (hasUrl !== hasKey || (value.CATALOG_SOURCE === "supabase" && !hasUrl)) {
    context.addIssue({ code: "custom", path: ["CATALOG_SOURCE"], message: "Supabase mode requires both the project URL and publishable key." });
  }
});

/** @param {Record<string, string | undefined>} values */
export function readCatalogConfig(values) {
  const parsed = schema.safeParse({
    CATALOG_SOURCE: values.CATALOG_SOURCE || undefined,
    NEXT_PUBLIC_SUPABASE_URL: values.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
  });
  if (!parsed.success) {
    throw new Error(`Invalid catalog configuration: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  }
  if (parsed.data.CATALOG_SOURCE === "development" && values.SITE_INDEXING_ENABLED === "true") {
    throw new Error("The development catalogue cannot be used with search indexing enabled.");
  }
  return {
    source: parsed.data.CATALOG_SOURCE,
    supabase: parsed.data.NEXT_PUBLIC_SUPABASE_URL && parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ? { url: parsed.data.NEXT_PUBLIC_SUPABASE_URL, publishableKey: parsed.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
      : null,
  };
}
