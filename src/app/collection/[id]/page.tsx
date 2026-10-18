import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";

import { PieceCard } from "@/components/collection/piece-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { deliveryThreshold, store } from "@/config/store";
import { photographDescriptions, toneByDesign } from "@/data/collection";

import { getStorefrontCatalog } from "@/lib/catalog/server";
import { formatGbp } from "@/lib/money";

import "../collection.css";
import "./product.css";

type PiecePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PiecePageProps): Promise<Metadata> {
  const pieces = await getStorefrontCatalog();
  const id = (await params).id;
  const piece = pieces.find((item) => item.id === id);
  if (!piece) return { title: "Piece not found", robots: { index: false, follow: false } };
  return {
    title: piece.visualLabel,
    description: piece.commerce?.description || photographDescriptions[piece.id] || piece.photos[0].alt,
  };
}

export default async function PiecePage({ params }: PiecePageProps) {
  const pieces = await getStorefrontCatalog();
  const id = (await params).id;
  const piece = pieces.find((item) => item.id === id);
  if (!piece) notFound();
  const position = pieces.findIndex((item) => item.id === piece.id);
  const related = Array.from({ length: Math.min(3, pieces.length - 1) }, (_, index) => pieces[(position + index + 1) % pieces.length]);
  const enquiry = `mailto:${store.supportEmail}?subject=${encodeURIComponent(`SEEN enquiry: ${piece.visualLabel} (${piece.id})`)}`;

  return (
    <div className="piece-page container">
      <nav className="catalog-breadcrumb piece-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><Link href="/collection">The collection</Link><span aria-hidden="true">/</span><span aria-current="page">{piece.visualLabel}</span></nav>
      <section className="piece-layout" aria-labelledby="piece-title">
        <ProductGallery key={piece.id} piece={piece} />
        <div className="piece-information">
          <p className="eyebrow">The SEEN Collection</p>
          <h1 id="piece-title">{piece.visualLabel}</h1>
          <p className="piece-description">{piece.commerce?.description || photographDescriptions[piece.id] || piece.photos[0].alt}</p>
          {piece.commerce && <p className="piece-price">{formatGbp(piece.commerce.pricePence)}</p>}
          <div className="piece-colour"><span>Photographed in</span><span><span className={`piece-colour__swatch piece-colour__swatch--${toneByDesign[piece.id]?.toLowerCase()}`} aria-hidden="true" />{toneByDesign[piece.id]}</span></div>
          {piece.commerce && <div className="piece-sizes"><h2>Sizes</h2><ul>{piece.commerce.variants.map((variant) => <li key={variant.id}><span>{variant.sizeLabel}</span><span>{variant.available ? "Available" : "Out of stock"}</span></li>)}</ul></div>}
          <div className="piece-enquiry"><h2>{piece.commerce ? "Need help choosing?" : "Pricing, sizing & availability"}</h2><p>Contact our team for the current details of this piece.</p><ButtonLink href={enquiry}>Enquire about this piece<ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></ButtonLink></div>
          <div className="piece-information__details">
            <details><summary>Sizing &amp; fit<ChevronDown size={16} strokeWidth={1.3} aria-hidden="true" /></summary><p>Our team can help with measurements and sizing questions for this piece.</p></details>
            <details><summary>UK delivery<ChevronDown size={16} strokeWidth={1.3} aria-hidden="true" /></summary><p>Complimentary standard UK delivery on orders over {deliveryThreshold}.</p></details>
          </div>
          <Link className="text-link piece-return" href="/collection"><ArrowLeft size={16} strokeWidth={1.3} aria-hidden="true" />Back to the collection</Link>
        </div>
      </section>
      {related.length > 0 && <section className="piece-related" aria-labelledby="related-title"><h2 id="related-title">Explore more from SEEN.</h2><div className="catalog-grid">{related.map((item, index) => <Reveal key={item.id} delay={index * 65}><PieceCard piece={item} /></Reveal>)}</div></section>}
    </div>
  );
}
