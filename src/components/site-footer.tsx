import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { deliveryThreshold, store } from "@/config/store";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="contact">
      <div className="footer-main container">
        <div className="footer-brand">
          <BrandLogo />
          <p>Elegance that speaks for itself.</p>
        </div>

        <nav className="footer-column" aria-label="Explore SEEN">
          <h2>Explore</h2>
          <Link href="/collection" prefetch={false}>The collection</Link>
          <a href="/#our-story">Our story</a>
          <a href="/#home">Back to the beginning</a>
        </nav>

        <div className="footer-column" id="delivery">
          <h2>Delivery</h2>
          <p>Complimentary standard UK delivery on orders over {deliveryThreshold}.</p>
        </div>

        <div className="footer-column footer-contact">
          <h2>Customer care</h2>
          <p>For collection, sizing, and order enquiries.</p>
          <a className="text-link" href={`mailto:${store.supportEmail}`}>
            {store.supportEmail}
            <ArrowUpRight size={16} strokeWidth={1.4} aria-hidden="true" />
          </a>
        </div>
      </div>

      <div className="footer-bottom container">
        <p>© {new Date().getFullYear()} SEEN ABAYAS. All rights reserved.</p>
        <p>Made to Be Seen.</p>
      </div>
    </footer>
  );
}
