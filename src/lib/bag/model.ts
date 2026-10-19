import { store } from "@/config/store";
import type { CollectionPhoto } from "@/data/collection";

export const BAG_STORAGE_KEY = "seen.bag.v1";
export const MAX_BAG_LINES = 20;
export const MAX_LINE_QUANTITY = 10;
export type BagRequestLine = { variantId: string; quantity: number };
export type BagLine = BagRequestLine & {
  piece: { id: string; name: string; size: string; pricePence: number; photo: CollectionPhoto } | null;
  issue: "unavailable" | "insufficient-stock" | null;
};
export type BagQuote = { lines: BagLine[]; subtotalPence: number; freeDelivery: boolean };
export const emptyBag: BagQuote = { lines: [], subtotalPence: 0, freeDelivery: false };

/** Only identifiers and quantities cross the trust boundary. Prices never come from storage. */
export function parseBagLines(input: unknown): BagRequestLine[] | null {
  if (!Array.isArray(input) || input.length > MAX_BAG_LINES) return null;
  const ids = new Set<string>();
  const lines: BagRequestLine[] = [];
  for (const value of input) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const keys = Object.keys(value);
    if (keys.length !== 2 || !keys.includes("variantId") || !keys.includes("quantity")) return null;
    if (typeof value.variantId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.variantId)) return null;
    if (!Number.isInteger(value.quantity) || value.quantity < 1 || value.quantity > MAX_LINE_QUANTITY) return null;
    const variantId = value.variantId.toLowerCase();
    if (ids.has(variantId)) return null;
    ids.add(variantId);
    lines.push({ variantId, quantity: value.quantity });
  }
  return lines;
}

export function summarizeBag(lines: BagLine[], delivery = { freeDeliveryEnabled: true, freeDeliveryThresholdPence: store.freeStandardDeliveryThresholdPence as number }): BagQuote {
  const subtotalPence = lines.reduce((sum, line) => sum + (line.piece && !line.issue ? line.piece.pricePence * line.quantity : 0), 0);
  return { lines, subtotalPence, freeDelivery: delivery.freeDeliveryEnabled && subtotalPence > delivery.freeDeliveryThresholdPence };
}
