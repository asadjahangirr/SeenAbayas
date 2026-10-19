import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Image from "@/components/cms/image";
import Link from "@/components/cms/link";
import { ArrowUpRight } from "lucide-react";

import { PageBreadcrumb } from "@/components/content/page-breadcrumb";
import { LengthReference } from "@/components/content/size-guide";
import { Reveal } from "@/components/ui/reveal";
import developmentCatalog from "@/data/development-catalog.json";
import "../content.css";

const baseMetadata: Metadata = { title: "Size Guide", description: "How to measure for an abaya, understand length labels and ask the SEEN team for design-specific sizing advice." };

export default function SizeGuidePage() {
  return (
    <div className="help-page container">
      <PageBreadcrumb current="Size Guide" />
      <Reveal className="help-page__heading"><p className="eyebrow"><Copy text={"The size guide"} /></p><h1><Copy text={"Find Your"} /><br /><em><Copy text={"Perfect Fit."} /></em></h1><p><Copy text={"Measurements are provided to help you find the best fit. Please refer to the specific product details, as styles and silhouettes may vary."} /></p></Reveal>
      <div className="measurement-layout">
        <Reveal className="measurement-visual"><figure>
          <div className="measurement-visual__photo"><Image src="/images/products/design-04/front.webp" alt="Front view of a charcoal abaya, with garment length, chest and sleeve measurement positions indicated." fill sizes="(min-width: 768px) 40vw, 100vw" />
            <span className="measure-line measure-line--length" aria-hidden="true"><span><Copy text={"Length"} /></span></span><span className="measure-line measure-line--chest" aria-hidden="true"><span><Copy text={"Chest"} /></span></span><span className="measure-line measure-line--sleeve" aria-hidden="true"><span><Copy text={"Sleeve"} /></span></span>
          </div><figcaption><Copy text={"Measurement positions are illustrative. Refer to each design for its actual fit."} /></figcaption>
        </figure></Reveal>
        <Reveal className="measurement-instructions" delay={80}>
          <p className="eyebrow"><Copy text={"Before you choose"} /></p><h2><Copy text={"Measure a piece"} /><br /><em><Copy text={"you already love."} /></em></h2>
          <p><Copy text={"Lay a well-fitting abaya flat, smooth out the fabric and use a flexible measuring tape. Keep the tape straight without stretching the garment."} /></p>
          <ol><li><h3><Copy text={"Garment length"} /></h3><p><Copy text={"Measure from the highest point of the shoulder beside the neckline down to the hem. Consider the shoes you intend to wear."} /></p></li><li><h3><Copy text={"Chest"} /></h3><p><Copy text={"Measure straight across the garment from underarm to underarm. Double this flat measurement when comparing it with a full chest circumference."} /></p></li><li><h3><Copy text={"Sleeve"} /></h3><p><Copy text={"Measure from the shoulder seam to the cuff. Dropped shoulders and different sleeve shapes can change how this measurement is taken."} /></p></li></ol>
        </Reveal>
      </div>
      <Reveal><LengthReference lengths={developmentCatalog.lengthsInches} /></Reveal>
      <Reveal className="help-page__assistance"><div><p className="eyebrow"><Copy text={"A little guidance"} /></p><h2><Copy text={"Between sizes?"} /><br /><em><Copy text={"Let's find your fit."} /></em></h2></div><div><p><Copy text={"Length and body fit are different measurements. If you are between lengths, or need more room through the chest or sleeves, share the design and your measurements with our team so we can help you compare."} /></p><Link className="text-link" href="/contact"><Copy text={"Ask about sizing"} /><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></Link></div></Reveal>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
