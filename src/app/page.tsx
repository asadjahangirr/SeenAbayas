import { ArrowRight } from "lucide-react";
import { FeaturedCollection } from "@/components/home/featured-collection";
import { HeroLookbook } from "@/components/home/hero-lookbook";
import { ButtonLink } from "@/components/ui/button";
import { getStorefrontCatalog } from "@/lib/catalog/server";

export default async function Home() {
  const pieces = await getStorefrontCatalog();
  return (
    <>
      <section className="hero container" id="intro" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">The SEEN Collection</p>
          <h1 id="hero-title" aria-label="Made to Be Seen.">
            <span className="hero-title-line"><span>Made to</span></span>
            <span className="hero-title-line"><em>Be Seen.</em></span>
          </h1>
          <p className="hero-subtitle">Timeless modesty.<br />{" "}Effortless elegance.</p>
          <p className="hero-description">
            From everyday sophistication to statement evening pieces, discover
            refined silhouettes and considered details. Modestwear thoughtfully
            selected to complement your individual style, without compromising on modesty.
          </p>
          <div className="hero-actions">
            <ButtonLink href="/collection">
              Explore the collection
              <ArrowRight size={18} strokeWidth={1.4} aria-hidden="true" />
            </ButtonLink>
            <a className="text-link" href="/#contact">Get in touch</a>
          </div>
        </div>

        <HeroLookbook />
      </section>

      <FeaturedCollection pieces={pieces} />

      <section className="story-section" id="our-story" aria-labelledby="story-title">
        <div className="story-inner container">
          <div className="story-heading">
            <p className="eyebrow">Our Story</p>
            <h2 id="story-title">Rooted in Modesty.<br />Defined by Elegance.</h2>
          </div>
          <div className="story-copy">
            <p>
              Founded by sisters with a shared passion for modest fashion, SEEN
              was created to celebrate timeless elegance, individuality and confidence.
            </p>
            <p>
              We believe true elegance doesn&apos;t demand attention. It leaves an impression.
            </p>
            <a className="text-link" href="/#collection">
              More than modestwear
              <ArrowRight size={17} strokeWidth={1.4} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
