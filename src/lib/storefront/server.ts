import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { headers } from "next/headers";
import { environment } from "@/lib/environment";
import { createCatalogClient } from "@/lib/catalog/server";
import { getAdminRenderAccess } from "@/lib/admin/auth";
import {
  storefrontStateSchema,
  type StoreConnection,
  type StorefrontState,
} from "./model";

export const getStorefrontState = cache(async (): Promise<StorefrontState> => {
  const pathname = (await headers()).get("x-seen-pathname") || "";
  if (pathname === "/admin/preview" || pathname.startsWith("/admin/preview/")) {
    const { client } = await getAdminRenderAccess();
    const { data, error } = await client.rpc("admin_snapshot");
    if (error) throw new Error("Draft categories are unavailable.");
    return {
      revision: `draft-${data.site.version}`,
      needsMigration: false,
      categories: data.records
        .filter((r: { kind: string }) => r.kind === "category")
        .map((r: { payload: Record<string, unknown> }) => ({
          slug: String(r.payload.slug),
          name: String(r.payload.name),
          description: String(r.payload.description || ""),
        })),
    };
  }
  if (
    environment.catalog.source !== "supabase" &&
    process.env.CMS_SOURCE !== "supabase"
  )
    return { revision: "files", categories: [], needsMigration: false };
  const client = createCatalogClient();
  const { data, error } = await client.rpc("get_storefront_state");
  if (!error)
    return { ...storefrontStateSchema.parse(data), needsMigration: false };
  if (!["PGRST202", "42883"].includes(error.code))
    throw new Error("Store sync is temporarily unavailable.");
  // Existing installations still refresh their published content while the new
  // category/revision migration is pending. Never read private admin records.
  let [catalog, document] = await Promise.all([
    client.rpc("get_storefront_catalog_v2"),
    client.rpc("get_site_document"),
  ]);
  if (catalog.error && ["PGRST202", "42883"].includes(catalog.error.code)) {
    catalog = await client.rpc("get_storefront_catalog");
  }
  if (document.error && ["PGRST202", "42883"].includes(document.error.code) && process.env.CMS_SOURCE !== "supabase") {
    document = { ...document, success: true, data: null, error: null, status: 200, statusText: "OK" };
  }
  if (catalog.error || document.error)
    throw new Error(
      "Store sync is unavailable. Check the administration migrations.",
    );
  const categories = [
    ...new Map(
      (catalog.data || [])
        .filter((p) => p.category)
        .map((p) => [
          p.category!,
          {
            slug: p.category!,
            name: p.category_name || p.category!,
            description: "",
          },
        ]),
    ).values(),
  ];
  return {
    revision: createHash("sha256")
      .update(JSON.stringify([catalog.data, document.data]))
      .digest("hex"),
    categories,
    needsMigration: true,
  };
});

export async function getStoreConnection(): Promise<StoreConnection> {
  const catalog = environment.catalog.source;
  const content = process.env.CMS_SOURCE === "supabase" ? "supabase" : "files";
  if (catalog !== "supabase" && content !== "supabase")
    return { catalog, content, sync: "samples" };
  try {
    const state = await getStorefrontState();
    return {
      catalog,
      content,
      sync: state.needsMigration ? "migration-required" : "ready",
    };
  } catch {
    return { catalog, content, sync: "offline" };
  }
}
