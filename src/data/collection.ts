import media from "./media.generated.json";

export type CollectionPhoto = { src: string; label: string; alt: string };
export type CollectionPiece = {
  id: string;
  visualLabel: string;
  photos: CollectionPhoto[];
  tone?: string;
  category?: string;
  categoryName?: string;
  commerce?: {
    productId: string;
    description: string;
    pricePence: number;
    currency: "GBP";
    sizeKind?: "length-inches";
    variants: { id: string; sizeLabel: string; available: boolean }[];
  };
};

// Photography captions only. Commerce data will come from the approved catalog.
export const collectionPieces: CollectionPiece[] = media.pieces;
export const featuredPieces = media.featuredIds.map((id) => collectionPieces.find((piece) => piece.id === id)!);

export const photographTones = ["Black", "Burgundy", "Teal", "Blue", "Cream", "Brown", "Olive"] as const;
export type PhotographTone = typeof photographTones[number] | "Charcoal" | "Neutral";

// Visible colours for photo browsing, not confirmed commercial colour variants.
export const toneByDesign: Record<string, PhotographTone> = {
  "design-01": "Burgundy",
  "design-02": "Black",
  "design-03": "Black",
  "design-04": "Teal",
  "design-05": "Blue",
  "design-06": "Black",
  "design-07": "Cream",
  "design-08": "Brown",
  "design-09": "Olive",
};

// Visual descriptions only; fabric, care, sizes and commercial details need approval.
export const photographDescriptions: Record<string, string> = {
  "design-01": "Burgundy tones, a flowing silhouette and covered button detailing.",
  "design-02": "Tonal botanical detailing against a black silhouette.",
  "design-03": "Black lace detailing along the opening and sleeves.",
  "design-04": "A teal silhouette with covered buttons and wide sleeves.",
  "design-05": "A blue tie-dye pattern across a flowing silhouette.",
  "design-06": "Ivory polka dots across a black silhouette.",
  "design-07": "Soft cream tones with covered button detailing.",
  "design-08": "Rich brown tones, covered buttons and wide sleeves create a flowing silhouette with understated detail. An easy foundation for a considered everyday look. Accessories shown in the photographs are styling references; please contact us to confirm what is included.",
  "design-09": "An olive silhouette with covered buttons and wide sleeves. The simple lines and flowing shape bring quiet elegance to everyday dressing. Accessories shown in the photographs are styling references; please contact us to confirm what is included.",
};

export function pieceHref(piece: CollectionPiece) {
  return `/collection/${piece.id}`;
}

export function findPiece(id: string) {
  return collectionPieces.find((piece) => piece.id === id);
}
