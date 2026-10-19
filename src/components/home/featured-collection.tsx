"use client";
import { Copy } from "@/components/cms/content-provider";


import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "@/components/cms/image";
import Link from "@/components/cms/link";

import { ButtonLink } from "@/components/ui/button";
import { pieceHref, type CollectionPiece } from "@/data/collection";
import { formatGbp } from "@/lib/money";
import { useSiteDocument } from "@/components/cms/content-provider";

export function FeaturedCollection({ pieces: collectionPieces }: { pieces: CollectionPiece[] }) {
  const document = useSiteDocument();
  const selected = document.featured.map(id => collectionPieces.find(piece => piece.id === id)).filter((piece): piece is CollectionPiece => Boolean(piece));
  const featuredPieces = selected.length ? selected : collectionPieces.slice(0, 4);
  const pieces = featuredPieces.slice(0, 4);
  if (document.featured.length === 0) return null;

  return (
    <section className="collection-section container" id="collection" aria-labelledby="collection-title">
      <div className="collection-heading">
        <div><p className="eyebrow"><Copy text={"The edit"} /></p><h2 id="collection-title"><Copy text={"Considered in every detail."} /></h2></div>
        <p><Copy text={"A considered selection from SEEN."} /><br /><Copy text={"Find your next everyday signature."} /></p>
      </div>
      {pieces.length === 0 && <p className="collection-empty"><Copy text={"The collection is being prepared. Our team can help with any enquiries."} /></p>}
      <div className="collection-grid" id="collection-pieces">
        {pieces.map((piece) => (
          <article className="collection-card" key={piece.id}>
            <Link className="collection-card__open" href={pieceHref(piece)} prefetch={false} aria-label={`View piece: ${piece.visualLabel}`}>
              <span className="collection-card__image">
                <Image src={piece.photos[0].src} alt={piece.photos[0].alt} fill sizes="(min-width: 1440px) 320px, (min-width: 768px) 24vw, 48vw" />
                <span className="collection-card__overlay" aria-hidden="true"><span><Copy text={"Discover this piece"} /></span><ArrowUpRight size={19} strokeWidth={1.2} /></span>
              </span>
              <span className="collection-card__caption"><span><Copy text={piece.visualLabel} />{piece.commerce && <span className="collection-card__price"><Copy text={formatGbp(piece.commerce.pricePence)} /></span>}</span><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></span>
            </Link>
          </article>
        ))}
      </div>
      <div className="collection-more">
        <ButtonLink href="/collection"><Copy text={"Explore the collection"} /><ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" /></ButtonLink>
      </div>

    </section>
  );
}
