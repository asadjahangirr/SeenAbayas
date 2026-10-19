import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { defaultDocument, siteDocumentSchema } from "./model";
import { headers } from "next/headers";
import { getAdminRenderAccess } from "@/lib/admin/auth";
import { environment } from "@/lib/environment";

export const getSiteDocument = cache(async () => {
  const pathname = (await headers()).get("x-seen-pathname") || "";
  if (pathname === "/admin/preview" || pathname.startsWith("/admin/preview/")) {
    const { client } = await getAdminRenderAccess();
    const snapshot = await client.rpc("admin_snapshot");
    if (snapshot.error) throw new Error("Draft content is unavailable.");
    const parsed = siteDocumentSchema.safeParse(snapshot.data.site.draft);
    return parsed.success ? parsed.data : defaultDocument;
  }
  if (process.env.CMS_SOURCE !== "supabase") return defaultDocument;
  const url = environment.catalog.supabase?.url;
  const key = environment.catalog.supabase?.publishableKey;
  if (!url || !key) throw new Error("CMS configuration is incomplete.");
  const client = createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }),
    },
  });
  const { data, error } = await client.rpc("get_site_document");
  if (error) throw new Error("Site content is temporarily unavailable.");
  if (!data) return defaultDocument;
  return siteDocumentSchema.parse(data);
});
