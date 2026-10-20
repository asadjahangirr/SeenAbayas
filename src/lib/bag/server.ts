import "server-only";
import { z } from "zod";
import { parseBagLines, summarizeBag, type BagRequestLine } from "./model";
import {
  createCatalogClient,
  getStorefrontCatalog,
} from "@/lib/catalog/server";
import { checkDevelopmentAvailability } from "@/lib/catalog/development";
import { getSiteDocument } from "@/lib/cms/server";
import { environment } from "@/lib/environment";

const availabilitySchema = z.array(
  z.object({ variant_id: z.uuid(), can_fulfil: z.boolean() }).strict(),
);

/** Shared, read-only source of truth for bag and checkout review. Never reserves stock. */
export async function getBagState(lines: BagRequestLine[]) {
  if (!parseBagLines(lines)) throw new Error("Invalid bag selection");
  if (!lines.length) {
    const document = await getSiteDocument();
    return { document, quote: summarizeBag([], document.commerce) };
  }
  if (environment.catalog.source === "preview")
    throw new Error("Catalogue is not available for shopping");
  const [document, pieces, { data, error }] = await Promise.all([
    getSiteDocument(),
    getStorefrontCatalog(),
    environment.catalog.source === "development"
      ? { data: checkDevelopmentAvailability(lines), error: null }
      : createCatalogClient().rpc("check_bag_availability", {
          requested_lines: lines.map((line) => ({
            variant_id: line.variantId,
            quantity: line.quantity,
          })),
        }),
  ]);
  const parsed = availabilitySchema.safeParse(data);
  if (error || !parsed.success || parsed.data.length !== lines.length)
    throw new Error("Availability unavailable");
  const availability = new Map(
    parsed.data.map((row) => [row.variant_id, row.can_fulfil]),
  );
  if (
    availability.size !== lines.length ||
    lines.some((line) => !availability.has(line.variantId))
  )
    throw new Error("Invalid availability response");
  const quote = summarizeBag(
    lines.map((line) => {
      const piece = pieces.find((item) =>
        item.commerce?.variants.some(
          (variant) => variant.id === line.variantId,
        ),
      );
      const variant = piece?.commerce?.variants.find(
        (item) => item.id === line.variantId,
      );
      if (!piece?.commerce || !variant)
        return { ...line, piece: null, issue: "unavailable" as const };
      return {
        ...line,
        piece: {
          id: piece.id,
          name: piece.visualLabel,
          size: variant.sizeLabel,
          pricePence: piece.commerce.pricePence,
          photo: piece.photos[0],
        },
        issue: !variant.available
          ? ("unavailable" as const)
          : !availability.get(line.variantId)
            ? ("insufficient-stock" as const)
            : null,
      };
    }),
    document.commerce,
  );
  return { document, quote };
}
