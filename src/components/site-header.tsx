"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { DeliveryAnnouncement } from "@/components/delivery-announcement";
import { navigation, store } from "@/config/store";
import { keepFocusInDialog } from "@/lib/dialog-focus";

function NavigationLabel({ label }: { label: string }) {
  return (
    <span className="nav-label">
      <span className="nav-label__original">{label}</span>
      <span className="nav-label__duplicate" aria-hidden="true">{label}</span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
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

        <a className="header-contact" href="/#contact" aria-label="Customer care">
          <span>Customer care</span>
          <ArrowUpRight size={18} strokeWidth={1.4} aria-hidden="true" />
        </a>
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
            <h2 id="navigation-title">Explore SEEN</h2>
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
          <div className="navigation-dialog__bottom">
            <p>Elegance that speaks for itself.</p>
            <a href={`mailto:${store.supportEmail}`}>{store.supportEmail}</a>
          </div>
        </div>
      </dialog>
    </header>
  );
}
