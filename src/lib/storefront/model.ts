import { z } from "zod";

export const storefrontCategorySchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
    name: z.string().min(1).max(150),
    description: z.string().max(1000),
  })
  .strict();
export type StorefrontCategory = z.infer<typeof storefrontCategorySchema>;
export const storefrontStateSchema = z
  .object({
    revision: z.string().min(1).max(100),
    categories: z.array(storefrontCategorySchema),
  })
  .strict();
export type StorefrontState = z.infer<typeof storefrontStateSchema> & {
  needsMigration: boolean;
};

export type StoreConnection = {
  catalog: "preview" | "development" | "supabase";
  content: "files" | "supabase";
  sync: "ready" | "migration-required" | "offline" | "samples";
};
