import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { CollectionBrowser } from "@/components/collection/collection-browser";
import { Reveal } from "@/components/ui/reveal";
import { store } from "@/config/store";
import { getStorefrontCatalog } from "@/lib/catalog/server";
import { collectionPieces } from "@/data/collection";

import "./collection.css";

export const metadata: Metadata = {
  title: "The Collection",
  description: "Explore the SEEN abaya collection, from burgundy silhouettes to tonal details and soft neutrals. Discover each piece through our photography.",
};

export default async function CollectionPage() {
  const pieces = await getStorefrontCatalog();
  return (
    <>
      <div className="catalog-intro container">
        <nav className="catalog-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">The collection</span></nav>
        <div className="catalog-intro__layout">
          <div className="catalog-intro__copy"><p className="eyebrow">SEEN ABAYAS</p><h1 aria-label="The Collection."><span>The</span><em>Collection.</em></h1><p>Timeless modesty. Effortless elegance.<br />Explore silhouettes and details that speak to you.</p></div>
          <Reveal className="catalog-intro__imagery" delay={100}>
            <figure><div><Image src={collectionPieces[0].photos[2].src} alt={collectionPieces[0].photos[2].alt} fill preload sizes="(min-width: 1024px) 255px, (min-width: 768px) 24vw, 45vw" /></div><figcaption>Covered buttons</figcaption></figure>
            <figure><div><Image src={collectionPieces[2].photos[1].src} alt={collectionPieces[2].photos[1].alt} fill sizes="(min-width: 1024px) 220px, (min-width: 768px) 21vw, 40vw" /></div><figcaption>Lace detailing</figcaption></figure>
          </Reveal>
        </div>
      </div>
      <CollectionBrowser pieces={pieces} />
      <Reveal className="catalog-assistance container"><div><h2>Here to help you choose.</h2><p>For sizing and availability, speak with our team.<br /><a className="text-link" href={`mailto:${store.supportEmail}`}>Customer care<ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></a></p></div></Reveal>
    </>
  );
}
