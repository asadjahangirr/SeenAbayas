import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { environment } from "@/lib/environment";

import "./globals.css";

const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const cormorant = localFont({
  src: [
    {
      path: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2",
      weight: "300 700",
      style: "normal",
    },
    {
      path: "../../node_modules/@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2",
      weight: "300 700",
      style: "italic",
    },
  ],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: environment.siteUrl ? new URL(environment.siteUrl) : undefined,
  title: {
    default: "SEEN ABAYAS | Made to Be Seen.",
    template: "%s | SEEN ABAYAS",
  },
  description:
    "A modern modest fashion brand celebrating timeless elegance, individuality and confidence. Made to Be Seen.",
  icons: { icon: { url: "/images/brand/logo.webp", type: "image/webp" } },
  robots: {
    index: environment.indexingEnabled,
    follow: environment.indexingEnabled,
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Nonces must be rendered per request rather than reused in a static page.
  await headers();

  return (
    <html lang="en-GB" className={`${inter.variable} ${cormorant.variable}`}>
      <body id="home">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
