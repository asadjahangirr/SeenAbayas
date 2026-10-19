
import { CmsAnchor } from "@/components/cms/anchor";
import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";
import { ArrowUpRight } from "lucide-react";

import { CollectionBrowser } from "@/components/collection/collection-browser";
import { Reveal } from "@/components/ui/reveal";
import { store } from "@/config/store";
import { getStorefrontCatalog } from "@/lib/catalog/server";
import { getStorefrontState } from "@/lib/storefront/server";

import "./collection.css";

const baseMetadata: Metadata = {
  title: "The Collection",
  description: "Explore the SEEN abaya collection, from burgundy silhouettes to tonal details and soft neutrals. Discover each piece through our photography.",
};

export default async function CollectionPage() {
  const [pieces, state] = await Promise.all([getStorefrontCatalog(), getStorefrontState()]);
  return (
    <>
      <div className="catalog-intro container">
        <nav className="catalog-breadcrumb" aria-label="Breadcrumb"><Link href="/"><Copy text={"Home"} /></Link><span aria-hidden="true"><Copy text={"/"} /></span><span aria-current="page"><Copy text={"The collection"} /></span></nav>
        <div className="catalog-heading"><h1><Copy text={"The Collection"} /></h1><p><Copy text={"Refined silhouettes. A piece for every part of your day."} /></p></div>
      </div>
      <CollectionBrowser pieces={pieces} categories={state.categories} />
      <Reveal className="catalog-assistance container"><div><h2><Copy text={"Here to help you choose."} /></h2><p><Copy text={"For sizing and availability, speak with our team."} /><br /><CmsAnchor className="text-link" href={`mailto:${store.supportEmail}`}><Copy text={"Customer care"} /><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor></p></div></Reveal>
    </>
  );
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
