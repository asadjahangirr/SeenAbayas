"use client";

import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { PhotoGallery, type PhotoGalleryHandle } from "@/components/collection/photo-gallery";
import { Button, ButtonLink } from "@/components/ui/button";
import { featuredPieces as photoFeatures, type CollectionPiece } from "@/data/collection";

export function FeaturedCollection({ pieces: collectionPieces }: { pieces: CollectionPiece[] }) {
  const selected = collectionPieces.filter((piece) => photoFeatures.some((featured) => featured.id === piece.id));
  const featuredPieces = selected.length ? selected : collectionPieces.slice(0, 4);
  const [expanded, setExpanded] = useState(false);
  const galleryRef = useRef<PhotoGalleryHandle>(null);
  const remaining = collectionPieces.filter((piece) => !featuredPieces.some((featured) => featured.id === piece.id));
  const pieces = expanded ? [...featuredPieces, ...remaining] : featuredPieces;

  return (
    <section className="collection-section container" id="collection" aria-labelledby="collection-title">
      <div className="collection-heading">
        <div><p className="eyebrow">The edit</p><h2 id="collection-title">Considered in every detail.</h2></div>
        <p>Fluid silhouettes. Quiet statements.<br />Discover the pieces, a little closer.</p>
      </div>
      {pieces.length === 0 && <p className="collection-empty">The collection is being prepared. Our team can help with any enquiries.</p>}
      <div className="collection-grid" id="collection-pieces">
        {pieces.map((piece) => (
          <article className="collection-card" key={piece.id}>
            <button type="button" className="collection-card__open" aria-label={`View photographs: ${piece.visualLabel}`} aria-haspopup="dialog" onClick={(event) => galleryRef.current?.open(piece, event.currentTarget)}>
              <span className="collection-card__image">
                <Image src={piece.photos[0].src} alt={piece.photos[0].alt} fill sizes="(min-width: 1440px) 320px, (min-width: 768px) 24vw, 48vw" />
                <span className="collection-card__overlay" aria-hidden="true"><span>View photographs</span><Plus size={19} strokeWidth={1.2} /></span>
              </span>
              <span className="collection-card__caption"><span>{piece.visualLabel}</span><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></span>
            </button>
          </article>
        ))}
      </div>
      <div className="collection-more">
        {remaining.length > 0 && <Button variant="secondary" aria-expanded={expanded} aria-controls="collection-pieces" onClick={() => setExpanded(!expanded)}>{expanded ? "Show fewer pieces" : "View more pieces"}<span aria-hidden="true">{expanded ? "−" : "+"}</span></Button>}
        <ButtonLink href="/collection">Explore the collection<ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" /></ButtonLink>
      </div>

      <PhotoGallery ref={galleryRef} />
    </section>
  );
}
