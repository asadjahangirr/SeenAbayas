import { expect, test } from "@playwright/test";
import { collectionPieces } from "@/data/collection";
import { checkDevelopmentAvailability, getDevelopmentCatalog } from "@/lib/catalog/development";

test("development catalogue uses supplied photos, chosen prices and 35 distinct temporary length variants", () => {
  const pieces = getDevelopmentCatalog();
  expect(pieces).toHaveLength(7);
  expect(pieces.map((piece) => piece.commerce!.pricePence)).toEqual([7500, 8500, 8500, 6900, 7500, 6900, 7500]);
  const ids = pieces.flatMap((piece) => piece.commerce!.variants.map((variant) => variant.id));
  expect(new Set(ids).size).toBe(35);
  for (const piece of pieces) {
    expect(piece.photos).toEqual(collectionPieces.find((source) => source.id === piece.id)!.photos);
    expect(piece.commerce!.variants.map((variant) => variant.sizeLabel)).toEqual(["52", "54", "56", "58", "60"]);
  }
  expect(JSON.stringify(pieces)).not.toMatch(/stockPerSize|on_hand|reserved/);
  expect(collectionPieces[0].commerce).toBeUndefined();
});

test("sample stock checks permit five units and reject unavailable IDs or six units", () => {
  const variantId = getDevelopmentCatalog()[0].commerce!.variants[0].id;
  expect(checkDevelopmentAvailability([{ variantId, quantity: 5 }])).toEqual([{ variant_id: variantId, can_fulfil: true }]);
  expect(checkDevelopmentAvailability([{ variantId, quantity: 6 }])).toEqual([{ variant_id: variantId, can_fulfil: false }]);
  expect(checkDevelopmentAvailability([{ variantId: "70000000-0000-4000-8000-000000000099", quantity: 1 }])[0].can_fulfil).toBe(false);
});
