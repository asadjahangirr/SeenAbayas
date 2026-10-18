import { z } from "zod";
import type { CollectionPiece } from "@/data/collection";

const variant = z.object({
  id: z.uuid(),
  size_label: z.string().trim().min(1).max(50),
  available: z.boolean(),
}).strict();

export const catalogRowSchema = z.object({
  product_id: z.uuid(),
  design_reference: z.string().regex(/^design-[0-9]{2,4}$/),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(2000),
  price_pence: z.number().int().min(1).max(99_999_999),
  currency: z.literal("GBP"),
  variants: z.array(variant).min(1),
}).strict();

export type CatalogRow = z.infer<typeof catalogRowSchema>;

export class CatalogUnavailableError extends Error {
  constructor() { super("The catalog is temporarily unavailable."); this.name = "CatalogUnavailableError"; }
}

export function mapCatalogRows(input: unknown, photography: CollectionPiece[]): CollectionPiece[] {
  const parsed = z.array(catalogRowSchema).safeParse(input);
  if (!parsed.success) throw new CatalogUnavailableError();
  const products = new Set<string>();
  const references = new Set<string>();
  const variants = new Set<string>();
  const pieces: CollectionPiece[] = [];
  for (const row of parsed.data) {
    if (products.has(row.product_id) || references.has(row.design_reference)) throw new CatalogUnavailableError();
    products.add(row.product_id);
    references.add(row.design_reference);
    const sizes = new Set<string>();
    for (const item of row.variants) {
      const size = item.size_label.toLocaleLowerCase("en-GB");
      if (variants.has(item.id) || sizes.has(size)) throw new CatalogUnavailableError();
      variants.add(item.id);
      sizes.add(size);
    }
    const source = photography.find((piece) => piece.id === row.design_reference);
    // A database record cannot manufacture a photograph for an unphotographed design.
    if (!source) continue;
    pieces.push({ ...source, visualLabel: row.name, commerce: {
      productId: row.product_id,
      description: row.description,
      pricePence: row.price_pence,
      currency: row.currency,
      variants: row.variants.map((item) => ({ id: item.id, sizeLabel: item.size_label, available: item.available })),
    } });
  }
  return pieces;
}

