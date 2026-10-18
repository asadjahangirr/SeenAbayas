import type { CatalogRow } from "./contract";

// The read-only RPC contract used by this phase. Regenerate the full project types
// with the Supabase CLI after applying the migration to a real project.
export type CatalogDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: { get_storefront_catalog: { Args: Record<string, never>; Returns: CatalogRow[] } };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
