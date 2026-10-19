"use client";
import { CmsAnchor } from "@/components/cms/anchor";

import { Copy } from "@/components/cms/content-provider";


import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "@/components/cms/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { DeliveryAnnouncement } from "@/components/delivery-announcement";
import { BagTrigger } from "@/components/bag/bag-trigger";
import { helpNavigation, navigation, store } from "@/config/store";
import { keepFocusInDialog } from "@/lib/dialog-focus";

function NavigationLabel({ label }: { label: string }) {
  return (
    <span className="nav-label">
      <span className="nav-label__original"><Copy text={label} /></span>
      <span className="nav-label__duplicate" aria-hidden="true"><Copy text={label} /></span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname().replace(/^\/admin\/preview/, "") || "/";
  const currentLocation = (href: string) => href === pathname ? "page" : href === "/collection" && pathname.startsWith("/collection/") ? "location" : undefined;
  const menuRef = useRef<HTMLDialogElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) menuRef.current?.close();
    };

    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function openMenu() {
    menuRef.current?.showModal();
    setIsMenuOpen(true);
  }

  function closeMenu() {
    menuRef.current?.close();
  }

  return (
    <header className="site-header">
      <DeliveryAnnouncement />

      <div className="header-inner container">
        <nav className="desktop-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} prefetch={false} aria-current={currentLocation(item.href)}><NavigationLabel label={item.label} /></Link>
          ))}
        </nav>

        <button
          className="icon-button mobile-menu-trigger"
          type="button"
          onClick={openMenu}
          aria-label="Open navigation menu"
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-navigation"
        >
          <Menu size={22} strokeWidth={1.4} aria-hidden="true" />
        </button>

        <BrandLogo />

        <div className="header-actions"><Link className="header-contact" href="/contact" prefetch={false} aria-label="Customer care">
          <span><Copy text={"Customer care"} /></span>
          <ArrowUpRight size={18} strokeWidth={1.4} aria-hidden="true" />
        </Link><BagTrigger /></div>
      </div>

      <dialog
        ref={menuRef}
        id="mobile-navigation"
        className="navigation-dialog"
        aria-labelledby="navigation-title"
        onKeyDown={keepFocusInDialog}
        onClose={() => setIsMenuOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMenu();
        }}
      >
        <div className="navigation-dialog__content">
          <div className="navigation-dialog__top">
            <h2 id="navigation-title"><Copy text={"Explore SEEN"} /></h2>
            <button
              autoFocus
              className="icon-button"
              type="button"
              onClick={closeMenu}
              aria-label="Close navigation menu"
            >
              <X size={22} strokeWidth={1.4} aria-hidden="true" />
            </button>
          </div>
          <nav className="mobile-nav" aria-label="Mobile navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} prefetch={false} onClick={closeMenu} aria-current={currentLocation(item.href)}>
                <NavigationLabel label={item.label} />
                <ArrowUpRight size={22} strokeWidth={1.2} aria-hidden="true" />
              </Link>
            ))}
          </nav>
          <nav className="mobile-help-nav" aria-label="Help and advice">
            {helpNavigation.map((item) => <Link key={item.href} href={item.href} prefetch={false} onClick={closeMenu} aria-current={currentLocation(item.href)}><Copy text={item.label} /><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></Link>)}
          </nav>
          <div className="navigation-dialog__bottom">
            <p><Copy text={"Elegance that speaks for itself."} /></p>
            <CmsAnchor href={`mailto:${store.supportEmail}`}><Copy text={store.supportEmail} /></CmsAnchor>
          </div>
        </div>
      </dialog>
    </header>
  );
}
