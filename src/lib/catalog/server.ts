import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cache } from "react";

import { collectionPieces } from "@/data/collection";
import { environment } from "@/lib/environment";
import { CatalogUnavailableError, mapCatalogRows } from "./contract";
import type { CatalogDatabase } from "./database";

export const getStorefrontCatalog = cache(async () => {
  if (environment.catalog.source === "preview") return collectionPieces;
  const config = environment.catalog.supabase;
  if (!config) throw new CatalogUnavailableError();
  try {
    const client = createClient<CatalogDatabase>(config.url, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, {
        ...init,
        cache: "no-store",
        signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000),
      }) },
    });
    const { data, error } = await client.rpc("get_storefront_catalog", {});
    if (error) throw new CatalogUnavailableError();
    return mapCatalogRows(data, collectionPieces);
  } catch {
    // Do not leak database errors, headers or connection configuration to shoppers.
    // Supabase failures must never fall back to invented or preview merchandise.
    throw new CatalogUnavailableError();
  }
});
