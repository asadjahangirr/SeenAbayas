"use client";

import { ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { pieceHref, toneByDesign, type CollectionPiece } from "@/data/collection";
import { formatGbp } from "@/lib/money";

export function PieceCard({ piece, onQuickView }: {
  piece: CollectionPiece;
  onQuickView?: (piece: CollectionPiece, trigger: HTMLButtonElement) => void;
}) {
  return (
    <article className="catalog-card">
      <div className="catalog-card__visual">
        <Link className="catalog-card__open" href={pieceHref(piece)} prefetch={false} aria-label={`View piece: ${piece.visualLabel}`}>
          <span className="catalog-card__image">
            <Image src={piece.photos[0].src} alt={piece.photos[0].alt} fill sizes="(min-width: 1440px) 437px, (min-width: 1024px) 31vw, 47vw" />
            {piece.photos[1] && <Image className="catalog-card__alternate" src={piece.photos[1].src} alt="" aria-hidden="true" fill sizes="(min-width: 1440px) 437px, (min-width: 1024px) 31vw, 47vw" />}
          </span>
        </Link>
        {onQuickView && <button type="button" className="catalog-card__quickview" aria-label={`View photographs: ${piece.visualLabel}`} aria-haspopup="dialog" onClick={(event) => onQuickView(piece, event.currentTarget)}><span>A closer look</span><Plus size={18} strokeWidth={1.2} aria-hidden="true" /></button>}
      </div>
      <div className="catalog-card__caption"><span><Link className="catalog-card__name" href={pieceHref(piece)} prefetch={false}>{piece.visualLabel}</Link><span className="catalog-card__tone">{toneByDesign[piece.id]} · {piece.photos.length} {piece.photos.length === 1 ? "photograph" : "photographs"}</span>{piece.commerce && <span className="catalog-card__price">{formatGbp(piece.commerce.pricePence)}</span>}</span><ArrowUpRight size={18} strokeWidth={1.2} aria-hidden="true" /></div>
    </article>
  );
}
