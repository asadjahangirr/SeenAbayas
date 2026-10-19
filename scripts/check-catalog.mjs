import nextEnvironment from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readCatalogConfig } from "../src/lib/catalog/config.mjs";

nextEnvironment.loadEnvConfig(process.cwd());
try {
  const config = readCatalogConfig(process.env);
  if (!config.supabase) {
    console.error("Supabase is not configured. Create the project, apply the catalog migration, and set the URL and publishable key in .env.local.");
    process.exitCode = 2;
  } else {
    const client = createClient(config.supabase.url, config.supabase.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
    });
    const { data, error } = await client.rpc("get_storefront_catalog", {});
    if (error || !Array.isArray(data)) throw new Error("Catalog read failed.");
    console.log(`Read-only Supabase catalog check succeeded. Published records: ${data.length}.`);
    console.log("No database changes were made. Use development mode for the sample catalogue, or supabase mode after real product data is ready.");
  }
} catch {
  console.error("Catalog check failed. Check the project configuration, migration and access rules; connection values have been omitted.");
  process.exitCode = 1;
}
