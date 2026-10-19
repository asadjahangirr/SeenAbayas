import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "@/components/cms/link";
import { FeaturedCollection } from "@/components/home/featured-collection";
import { FilmHero } from "@/components/home/film-hero";
import { getStorefrontCatalog } from "@/lib/catalog/server";

const baseMetadata: Metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const pieces = await getStorefrontCatalog();
  return (
    <>
      <FilmHero />

      <FeaturedCollection pieces={pieces} />

      <section className="story-section" id="our-story" aria-labelledby="story-title">
        <div className="story-inner container">
          <div className="story-heading">
            <p className="eyebrow"><Copy text={"Our Story"} /></p>
            <h2 id="story-title"><Copy text={"Rooted in Modesty."} /><br /><Copy text={"Defined by Elegance."} /></h2>
          </div>
          <div className="story-copy">
            <p><Copy text={"Founded by sisters with a shared passion for modest fashion, SEEN was created to celebrate timeless elegance, individuality and confidence."} /></p>
            <p><Copy text={"We believe true elegance doesn't demand attention. It leaves an impression."} /></p>
            <Link className="text-link" href="/our-story"><Copy text={"Discover our story"} /><ArrowRight size={17} strokeWidth={1.4} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
