import { collectionPieces, photographDescriptions, type CollectionPiece } from "@/data/collection";
import data from "@/data/development-catalog.json";
import type { BagRequestLine } from "@/lib/bag/model";

/** Explicit sample data. This module is consumed by server code, never the bag UI. */
export function getDevelopmentCatalog(): CollectionPiece[] {
  return data.products.flatMap((product, position) => {
    const photography = collectionPieces.find((piece) => piece.id === product.designReference);
    if (!photography) return [];
    return [{ ...photography, visualLabel: product.name, commerce: {
      productId: `60000000-0000-4000-8000-${String(position + 1).padStart(12, "0")}`,
      description: photographDescriptions[photography.id], pricePence: product.pricePence, currency: "GBP" as const,
      sizeKind: "length-inches" as const,
      variants: data.lengthsInches.map((length, index) => ({
        id: `70000000-0000-4000-8000-${String(position + 1).padStart(6, "0")}${String(index + 1).padStart(6, "0")}`,
        sizeLabel: `${length}`, available: data.stockPerSize > 0,
      })),
    } }];
  });
}

export function checkDevelopmentAvailability(lines: BagRequestLine[]) {
  const variants = new Set(getDevelopmentCatalog().flatMap((piece) => piece.commerce!.variants.map((variant) => variant.id)));
  return lines.map((line) => ({ variant_id: line.variantId, can_fulfil: variants.has(line.variantId) && line.quantity <= data.stockPerSize }));
}
