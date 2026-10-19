
import { CmsAnchor } from "@/components/cms/anchor";
import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Image from "@/components/cms/image";
import { ArrowRight } from "lucide-react";

import { PageBreadcrumb } from "@/components/content/page-breadcrumb";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import "../content.css";

const baseMetadata: Metadata = {
  title: "Our Story",
  description: "Founded by sisters with a shared passion for modest fashion, SEEN ABAYAS celebrates timeless elegance, individuality and confidence.",
};

export default function OurStoryPage() {
  return (
    <article className="brand-story">
      <div className="container"><PageBreadcrumb current="Our Story" /></div>
      <header className="brand-story__opening container">
        <Reveal className="brand-story__title">
          <p className="eyebrow"><Copy text={"Our Story"} /></p>
          <h1><Copy text={"Made to"} /><br /><em><Copy text={"Be Seen."} /></em></h1>
          <p className="brand-story__intro"><Copy text={"At SEEN ABAYAS, we believe modesty and style should exist effortlessly together."} /></p>
          <CmsAnchor className="text-link" href="#our-beginning"><Copy text={"Discover our story"} /><ArrowRight size={17} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor>
        </Reveal>
        <Reveal className="brand-story__portrait" delay={100}>
          <figure>
            <div className="editorial-photo brand-story__opening-photo"><Image src="/images/products/design-04/styled.webp" alt="A charcoal SEEN abaya styled with a matching scarf, photographed against an ivory interior." fill sizes="(min-width: 1024px) 52vw, 100vw" priority /></div>
            <figcaption><Copy text={"SEEN ABAYAS "} /><span><Copy text={"Timeless modesty. Effortless elegance."} /></span></figcaption>
          </figure>
        </Reveal>
      </header>

      <section className="brand-story__beginning container" id="our-beginning" aria-labelledby="beginning-title">
        <Reveal><p className="eyebrow"><Copy text={"Our beginning"} /></p><h2 id="beginning-title"><Copy text={"Founded"} /><br /><em><Copy text={"by Sisters."} /></em></h2></Reveal>
        <Reveal className="brand-story__prose" delay={80}>
          <p><Copy text={"Founded by sisters with a shared passion for modest fashion, SEEN was born from a vision to create a brand that celebrates timeless elegance, individuality and confidence."} /></p>
          <p><Copy text={"Created with the modern woman in mind, our collections bring together refined silhouettes, beautiful details and contemporary designs, offering modestwear that feels as special as the woman wearing it."} /></p>
        </Reveal>
      </section>

      <section className="brand-story__philosophy" aria-labelledby="philosophy-title">
        <div className="brand-story__philosophy-inner container">
          <Reveal className="editorial-photo brand-story__detail-photo"><Image src="/images/products/design-03/detail.webp" alt="Lace detailing on the sleeves and opening of a black SEEN abaya." fill sizes="(min-width: 768px) 42vw, 100vw" /></Reveal>
          <Reveal className="brand-story__philosophy-copy" delay={80}>
            <p className="eyebrow"><Copy text={"Our philosophy"} /></p>
            <h2 id="philosophy-title"><Copy text={"Elegance for"} /><br /><em><Copy text={"every occasion."} /></em></h2>
            <p><Copy text={"From everyday sophistication to statement evening pieces, each design is thoughtfully selected to complement every occasion, allowing you to express your personal style without compromising on modesty."} /></p>
          </Reveal>
        </div>
      </section>

      <Reveal className="brand-story__statement container">
        <p className="eyebrow"><Copy text={"The SEEN perspective"} /></p>
        <blockquote><Copy text={"We believe true elegance doesn't demand attention. "} /><em><Copy text={"It leaves an impression."} /></em></blockquote>
      </Reveal>

      <Reveal className="brand-story__closing container">
        <h2><Copy text={"More than modestwear."} /><br /><em><Copy text={"A statement of elegance."} /></em></h2>
        <p><Copy text={"SEEN ABAYAS — Elegance that speaks for itself."} /></p>
        <ButtonLink href="/collection"><Copy text={"Shop the collection"} /><ArrowRight size={18} strokeWidth={1.3} aria-hidden="true" /></ButtonLink>
      </Reveal>
    </article>
  );
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
