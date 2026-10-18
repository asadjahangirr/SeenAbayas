import media from "./media.generated.json";

export type CollectionPhoto = { src: string; label: string; alt: string };
export type CollectionPiece = {
  id: string;
  visualLabel: string;
  photos: CollectionPhoto[];
  commerce?: {
    productId: string;
    description: string;
    pricePence: number;
    currency: "GBP";
    variants: { id: string; sizeLabel: string; available: boolean }[];
  };
};

// Photography captions only. Commerce data will come from the approved catalog.
export const collectionPieces: CollectionPiece[] = media.pieces;
export const heroPieces = media.heroIds.map((id) => collectionPieces.find((piece) => piece.id === id)!);
export const featuredPieces = media.featuredIds.map((id) => collectionPieces.find((piece) => piece.id === id)!);

export const photographTones = ["Black", "Burgundy", "Charcoal", "Neutral"] as const;
export type PhotographTone = typeof photographTones[number];

// Visible colours for photo browsing, not confirmed commercial colour variants.
export const toneByDesign: Record<string, PhotographTone> = {
  "design-01": "Burgundy",
  "design-02": "Black",
  "design-03": "Black",
  "design-04": "Charcoal",
  "design-05": "Charcoal",
  "design-06": "Black",
  "design-07": "Neutral",
};

// Visual descriptions only; fabric, care, sizes and commercial details need approval.
export const photographDescriptions: Record<string, string> = {
  "design-01": "Burgundy tones, a flowing silhouette and covered button detailing.",
  "design-02": "Tonal botanical detailing against a black silhouette.",
  "design-03": "Black lace detailing along the opening and sleeves.",
  "design-04": "A plain charcoal silhouette with covered buttons.",
  "design-05": "A charcoal silhouette with a subtly textured appearance.",
  "design-06": "Ivory polka dots across a black silhouette.",
  "design-07": "Soft neutral tones with covered button detailing.",
};

export function pieceHref(piece: CollectionPiece) {
  return `/collection/${piece.id}`;
}

export function findPiece(id: string) {
  return collectionPieces.find((piece) => piece.id === id);
}
