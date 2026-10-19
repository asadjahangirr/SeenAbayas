
import { deliveryThresholdFor } from "@/lib/cms/model";
import { getSiteDocument } from "@/lib/cms/server";

import { CmsAnchor } from "@/components/cms/anchor";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";

import { PieceCard } from "@/components/collection/piece-card";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductPurchase } from "@/components/product/product-purchase";
import { SizeGuideTrigger } from "@/components/product/size-guide-trigger";
import { Reveal } from "@/components/ui/reveal";
import { store } from "@/config/store";
import { photographDescriptions, toneByDesign } from "@/data/collection";
import developmentCatalog from "@/data/development-catalog.json";

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
  const document = await getSiteDocument();
  const deliveryThreshold = deliveryThresholdFor(document);
  const position = pieces.findIndex((item) => item.id === piece.id);
  const related = Array.from({ length: Math.min(3, pieces.length - 1) }, (_, index) => pieces[(position + index + 1) % pieces.length]);
  const enquiry = `mailto:${store.supportEmail}?subject=${encodeURIComponent(`SEEN enquiry: ${piece.visualLabel} (${piece.id})`)}`;

  return (
    <div className="piece-page container">
      <nav className="catalog-breadcrumb piece-breadcrumb" aria-label="Breadcrumb"><Link href="/"><Copy text={"Home"} /></Link><span aria-hidden="true"><Copy text={"/"} /></span><Link href="/collection"><Copy text={"The collection"} /></Link><span aria-hidden="true"><Copy text={"/"} /></span><span aria-current="page"><Copy text={piece.visualLabel} /></span></nav>
      <section className="piece-layout" aria-labelledby="piece-title">
        <ProductGallery key={piece.id} piece={piece} />
        <div className="piece-information">
          <p className="eyebrow"><Copy text={"The SEEN Collection"} /></p>
          <h1 id="piece-title"><Copy text={piece.visualLabel} /></h1>
          {piece.commerce && <p className="piece-price"><Copy text={formatGbp(piece.commerce.pricePence)} /></p>}
          <div className="piece-colour"><span><Copy text={"Photographed in"} /></span><span><span className={`piece-colour__swatch piece-colour__swatch--${(piece.tone || toneByDesign[piece.id])?.toLowerCase()}`} aria-hidden="true" /><Copy text={piece.tone || toneByDesign[piece.id]} /></span></div>
          <ProductPurchase key={piece.id} commerce={piece.commerce} />
          <SizeGuideTrigger lengths={developmentCatalog.lengthsInches} />
          <CmsAnchor className="text-link piece-customer-care" href={enquiry}><Copy text={"Ask about sizing or availability"} /><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor>
          <p className="piece-description"><Copy text={piece.commerce?.description || photographDescriptions[piece.id] || piece.photos[0].alt} /></p>
          <div className="piece-information__details">
            <details><summary><Copy text={"Sizing & fit"} /><ChevronDown size={16} strokeWidth={1.3} aria-hidden="true" /></summary><p><Copy text={"Our team can help with measurements and sizing questions for this piece."} /></p></details>
            <details><summary><Copy text={"UK delivery"} /><ChevronDown size={16} strokeWidth={1.3} aria-hidden="true" /></summary><p>{document.commerce.freeDeliveryEnabled && <><Copy text={"Complimentary standard UK delivery on orders over "} /><Copy text={deliveryThreshold} /><Copy text={". "} /></>}<Link href="/shipping-delivery"><Copy text={"View delivery information"} /></Link><Copy text={"."} /></p></details>
          </div>
          <Link className="text-link piece-return" href="/collection"><ArrowLeft size={16} strokeWidth={1.3} aria-hidden="true" /><Copy text={"Back to the collection"} /></Link>
        </div>
      </section>
      {related.length > 0 && <section className="piece-related" aria-labelledby="related-title"><h2 id="related-title"><Copy text={"Explore more from SEEN."} /></h2><div className="catalog-grid">{related.map((item, index) => <Reveal key={item.id} delay={index * 65}><PieceCard piece={item} /></Reveal>)}</div></section>}
    </div>
  );
}
