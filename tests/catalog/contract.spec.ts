import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { collectionPieces } from "@/data/collection";
import { readCatalogConfig } from "@/lib/catalog/config.mjs";
import { mapCatalogRows } from "@/lib/catalog/contract";
import type { CatalogDatabase } from "@/lib/catalog/database";
import { formatGbp } from "@/lib/money";

const fixture = () => ({
  product_id: "10000000-0000-4000-8000-000000000001",
  design_reference: "design-01",
  name: "TEST ONLY approved name",
  description: "TEST ONLY approved description",
  price_pence: 12345,
  currency: "GBP",
  variants: [{ id: "20000000-0000-4000-8000-000000000001", size_label: "TEST S", available: true }],
});

test("preview is explicit and configured mode requires a complete publishable-key pair", () => {
  expect(readCatalogConfig({})).toEqual({ source: "preview", supabase: null });
  expect(() => readCatalogConfig({ CATALOG_SOURCE: "supabase" })).toThrow("requires both");
  expect(() => readCatalogConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" })).toThrow("requires both");
  expect(readCatalogConfig({ CATALOG_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_TEST_ONLY" }).source).toBe("supabase");
});

test("development data must be explicitly selected and cannot be indexed", () => {
  expect(readCatalogConfig({ CATALOG_SOURCE: "development" }).source).toBe("development");
  expect(() => readCatalogConfig({ CATALOG_SOURCE: "development", SITE_INDEXING_ENABLED: "true" })).toThrow("cannot be used with search indexing");
});

test("secret keys, unsafe origins and malformed values fail without exposing their contents", () => {
  for (const [url, key] of [
    ["https://example.supabase.co", "sb_secret_DO_NOT_EXPOSE"],
    ["http://remote.example.com", "sb_publishable_TEST_ONLY"],
    ["https://user:password@example.com", "sb_publishable_TEST_ONLY"],
    ["https://example.com/path", "sb_publishable_TEST_ONLY"],
  ]) {
    let message = "";
    try { readCatalogConfig({ CATALOG_SOURCE: "supabase", NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }); } catch (error) { message = (error as Error).message; }
    expect(message).toContain("Invalid catalog configuration");
    expect(message).not.toContain(url);
    expect(message).not.toContain(key);
  }
});

test("approved catalog rows merge with actual photography and display exact GBP pence", () => {
  const pieces = mapCatalogRows([fixture()], collectionPieces);
  expect(pieces).toHaveLength(1);
  expect(pieces[0].visualLabel).toBe("TEST ONLY approved name");
  expect(pieces[0].photos).toEqual(collectionPieces[0].photos);
  expect(pieces[0].commerce?.variants).toEqual([{ id: "20000000-0000-4000-8000-000000000001", sizeLabel: "TEST S", available: true }]);
  expect(formatGbp(pieces[0].commerce!.pricePence)).toBe("£123.45");
  expect(collectionPieces[0].commerce).toBeUndefined();
});

test("unphotographed designs and empty published catalogs never fall back to preview merchandise", () => {
  expect(mapCatalogRows([], collectionPieces)).toEqual([]);
  expect(mapCatalogRows([{ ...fixture(), design_reference: "design-9999" }], collectionPieces)).toEqual([]);
});

test("malformed or unexpectedly private catalog data fails closed", () => {
  for (const row of [
    { ...fixture(), price_pence: -1 },
    { ...fixture(), price_pence: 12.34 },
    { ...fixture(), currency: "USD" },
    { ...fixture(), name: "" },
    { ...fixture(), variants: [] },
    { ...fixture(), on_hand: 999 },
    { ...fixture(), variants: [{ ...fixture().variants[0], reserved: 1 }] },
  ]) expect(() => mapCatalogRows([row], collectionPieces)).toThrow("temporarily unavailable");
  expect(() => mapCatalogRows([fixture(), fixture()], collectionPieces)).toThrow("temporarily unavailable");
  expect(() => mapCatalogRows(null, collectionPieces)).toThrow("temporarily unavailable");
});

test("the installed Supabase SDK calls the read-only RPC with the publishable key", async () => {
  const calls: { url: string; method: string; key: string | null }[] = [];
  const client = createClient<CatalogDatabase>("https://example.supabase.co", "sb_publishable_TEST_ONLY", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      calls.push({ url: String(input), method: init?.method || "GET", key: new Headers(init?.headers).get("apikey") });
      return new Response(JSON.stringify([fixture()]), { status: 200, headers: { "Content-Type": "application/json" } });
    } },
  });
  const { data, error } = await client.rpc("get_storefront_catalog", {});
  expect(error).toBeNull();
  expect(calls).toEqual([{ url: "https://example.supabase.co/rest/v1/rpc/get_storefront_catalog", method: "POST", key: "sb_publishable_TEST_ONLY" }]);
  expect(mapCatalogRows(data, collectionPieces)[0].commerce?.pricePence).toBe(12345);
});
