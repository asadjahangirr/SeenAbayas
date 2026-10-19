"use client";
import { usePathname } from "next/navigation";
import type { ReactNode, CSSProperties } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { useSiteDocument } from "./cms/content-provider";
import { StoreMotion } from "./ui/store-motion";
import { PageMediaSections } from "./cms/media-sections";

export function StorefrontShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const document = useSiteDocument();
  if (pathname === "/admin" || pathname.startsWith("/admin/"))
    return (
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    );
  return (
    <div
      className="storefront-shell"
      style={
        {
          "--foreground": document.appearance.ink,
          "--background": document.appearance.paper,
          "--cms-accent": document.appearance.accent,
          "--seen-logo": `url("${document.media["/images/brand/seen-signature.svg"] || "/images/brand/seen-signature.svg"}")`,
        } as CSSProperties
      }
    >
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <PageMediaSections position="before" />
        {children}
        <PageMediaSections position="after" />
      </main>
      <SiteFooter />
      <StoreMotion settings={document.appearance} />
    </div>
  );
}
