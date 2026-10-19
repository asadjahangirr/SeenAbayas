import nextEnvironment from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readCatalogConfig } from "../src/lib/catalog/config.mjs";

nextEnvironment.loadEnvConfig(process.cwd());
try {
  const { supabase } = readCatalogConfig(process.env);
  if (!supabase) throw new Error("Configuration missing");
  const client = createClient(supabase.url, supabase.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) },
  });
  const { data, error } = await client.rpc("check_bag_availability", { requested_lines: [] });
  if (error || !Array.isArray(data) || data.length) throw new Error("Bag check unavailable");
  console.log("Read-only Supabase bag check succeeded. No stock was changed or reserved.");
} catch {
  console.error("Bag check unavailable. Verify the local configuration and apply only supabase/migrations/20261018000200_bag_availability.sql in the SQL Editor if it has not been applied. Connection values have been omitted.");
  process.exitCode = 1;
}
