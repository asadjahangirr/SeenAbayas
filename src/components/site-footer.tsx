"use client";
import { deliveryThresholdFor } from "@/lib/cms/model";

import { useSiteDocument } from "@/components/cms/content-provider";

import { CmsAnchor } from "@/components/cms/anchor";

import { Copy } from "@/components/cms/content-provider";
import { ArrowUpRight } from "lucide-react";
import Link from "@/components/cms/link";

import { BrandLogo } from "@/components/brand-logo";
import { legalNavigation, store } from "@/config/store";

export function SiteFooter() {
  const document = useSiteDocument();
  const deliveryThreshold = deliveryThresholdFor(document);
  return (
    <footer className="site-footer" id="contact">
      <div className="footer-main container">
        <div className="footer-brand" id="delivery">
          <BrandLogo />
          <p><Copy text={"Elegance that speaks for itself."} /></p>
          {document.commerce.freeDeliveryEnabled && <Link className="footer-delivery" href="/shipping-delivery" prefetch={false}><Copy text={"Complimentary standard UK delivery on orders over "} /><Copy text={deliveryThreshold} /><Copy text={"."} /></Link>}
        </div>

        <nav className="footer-column" aria-label="Explore SEEN">
          <h2><Copy text={"Explore"} /></h2>
          <Link href="/collection" prefetch={false}><Copy text={"The collection"} /></Link>
          <Link href="/bag" prefetch={false}><Copy text={"Shopping bag"} /></Link>
          <Link href="/our-story" prefetch={false}><Copy text={"Our story"} /></Link>
          <Link href="/size-guide" prefetch={false}><Copy text={"Size guide"} /></Link>
        </nav>

        <nav className="footer-column footer-contact" aria-label="Customer care">
          <h2><Copy text={"Customer care"} /></h2>
          <p><Copy text={"For collection, sizing, and order enquiries."} /></p>
          <Link href="/contact" prefetch={false}><Copy text={"Contact us"} /></Link>
          <Link href="/shipping-delivery" prefetch={false}><Copy text={"Shipping & Delivery"} /></Link>
          <Link href="/returns-exchanges" prefetch={false}><Copy text={"Returns & Exchanges"} /></Link>
          <Link href="/faqs" prefetch={false}><Copy text={"FAQs"} /></Link>
          <CmsAnchor className="text-link" href={`mailto:${store.supportEmail}`}>
            <Copy text={store.supportEmail} />
            <ArrowUpRight size={16} strokeWidth={1.4} aria-hidden="true" />
          </CmsAnchor>
        </nav>

        <nav className="footer-column footer-legal" aria-label="Legal information">
          <h2><Copy text={"Legal"} /></h2>
          {legalNavigation.map((item) => <Link key={item.href} href={item.href} prefetch={false}><Copy text={item.label} /></Link>)}
        </nav>
      </div>

      <div className="footer-bottom container">
        <p><Copy text={"© "} /><Copy text={new Date().getFullYear()} /><Copy text={" SEEN ABAYAS. All rights reserved."} /></p>
        <p><Copy text={"Made to Be Seen."} /></p>
      </div>
    </footer>
  );
}
