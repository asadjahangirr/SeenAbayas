import type { CatalogRow } from "./contract";

// The read-only RPC contract used by this phase. Regenerate the full project types
// with the Supabase CLI after applying the migration to a real project.
export type CatalogDatabase = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_storefront_catalog: { Args: Record<string, never>; Returns: CatalogRow[] };
      get_storefront_catalog_v2: { Args: Record<string, never>; Returns: CatalogRow[] };
      get_site_document: { Args: Record<string, never>; Returns: unknown };
      get_storefront_state: { Args: Record<string, never>; Returns: unknown };
      check_bag_availability: {
        Args: { requested_lines: { variant_id: string; quantity: number }[] };
        Returns: { variant_id: string; can_fulfil: boolean }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
