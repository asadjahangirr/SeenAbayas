"use client";
import { Copy } from "@/components/cms/content-provider";


import { ArrowUpRight } from "lucide-react";
import Image from "@/components/cms/image";
import Link from "@/components/cms/link";

import { pieceHref, toneByDesign, type CollectionPiece } from "@/data/collection";
import { formatGbp } from "@/lib/money";

export function PieceCard({ piece }: { piece: CollectionPiece }) {
  return (
    <article className="catalog-card">
      <div className="catalog-card__visual">
        <Link className="catalog-card__open" href={pieceHref(piece)} prefetch={false} aria-label={`View piece: ${piece.visualLabel}`}>
          <span className="catalog-card__image">
            <Image src={piece.photos[0].src} alt={piece.photos[0].alt} fill sizes="(min-width: 1440px) 437px, (min-width: 1024px) 31vw, 47vw" />
            {piece.photos[1] && <Image className="catalog-card__alternate" src={piece.photos[1].src} alt="" aria-hidden="true" fill sizes="(min-width: 1440px) 437px, (min-width: 1024px) 31vw, 47vw" />}
          </span>
        </Link>
      </div>
      <div className="catalog-card__caption"><span><Link className="catalog-card__name" href={pieceHref(piece)} prefetch={false}><Copy text={piece.visualLabel} /></Link><span className="catalog-card__tone"><Copy text={piece.tone || toneByDesign[piece.id]} /><Copy text={" · "} /><Copy text={piece.photos.length} /> <Copy text={piece.photos.length === 1 ? "photograph" : "photographs"} /></span>{piece.commerce && <span className="catalog-card__price"><Copy text={formatGbp(piece.commerce.pricePence)} /></span>}</span><ArrowUpRight size={18} strokeWidth={1.2} aria-hidden="true" /></div>
    </article>
  );
}
