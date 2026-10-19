import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

import { collectionPieces } from "@/data/collection";
import { environment } from "@/lib/environment";
import { CatalogUnavailableError, mapCatalogRows } from "./contract";
import type { CatalogDatabase } from "./database";
import { getDevelopmentCatalog } from "./development";
import { headers } from "next/headers";
import { getAdminRenderAccess } from "@/lib/admin/auth";
import type { AdminProduct } from "@/lib/admin/model";
import type { CollectionPiece } from "@/data/collection";

export function createCatalogClient() {
  const config = environment.catalog.supabase;
  if (!config) throw new CatalogUnavailableError();
  return createClient<CatalogDatabase>(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      cache: "no-store",
      signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
    }) },
  });
}

export const getStorefrontCatalog = cache(async () => {
  const pathname = (await headers()).get("x-seen-pathname") || "";
  if (pathname === "/admin/preview" || pathname.startsWith("/admin/preview/")) {
    const { client } = await getAdminRenderAccess();
    const { data, error } = await client.rpc("admin_snapshot");
    if (error) throw new CatalogUnavailableError();
    return (data.products as AdminProduct[]).filter(p => p.status !== "archived").flatMap(p => {
      const photos = p.photos.length ? p.photos : collectionPieces.find(piece => piece.id === p.design_reference)?.photos;
      if (!photos?.length) return [];
      const category=data.records.find((r:{kind:string;payload:{slug?:string;name?:string}})=>r.kind==="category"&&r.payload.slug===p.category);
      const piece: CollectionPiece = { id:p.design_reference, visualLabel:p.name || p.design_reference, photos, tone:p.tone, category:p.category, categoryName:category?.payload.name||p.category };
      if(p.price_pence && p.description) piece.commerce={productId:p.id,description:p.description,pricePence:p.price_pence,currency:"GBP",variants:p.variants.filter(v=>v.active).map(v=>({id:v.id,sizeLabel:v.size_label,available:v.on_hand>v.reserved}))};
      return [piece];
    });
  }
  if (environment.catalog.source === "preview") return collectionPieces;
  if (environment.catalog.source === "development") return getDevelopmentCatalog();
  try {
    const client = createCatalogClient();
    let { data, error } = await client.rpc("get_storefront_catalog_v2", {});
    if (error && ["PGRST202", "42883"].includes(error.code)) {
      ({ data, error } = await client.rpc("get_storefront_catalog", {}));
    }
    if (error) throw new CatalogUnavailableError();
    return mapCatalogRows(data, collectionPieces);
  } catch {
    // Do not leak database errors, headers or connection configuration to shoppers.
    // Supabase failures must never fall back to invented or preview merchandise.
    throw new CatalogUnavailableError();
  }
});
