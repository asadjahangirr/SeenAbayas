import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import { StorefrontShell } from "@/components/storefront-shell";
import { ContentProvider } from "@/components/cms/content-provider";
import { getSiteDocument } from "@/lib/cms/server";
import { defaultDocument, replaceCopy, replaceMedia } from "@/lib/cms/model";
import { BagProvider } from "@/components/bag/bag-provider";
import { environment } from "@/lib/environment";
import { getStorefrontState } from "@/lib/storefront/server";
import { StorefrontSync } from "@/components/cms/storefront-sync";

import "./globals.css";
import "@/components/bag/bag.css";

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

const baseMetadata: Metadata = {
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

export async function generateMetadata(): Promise<Metadata> {
  const pathname = (await headers()).get("x-seen-pathname") || "";
  const document =
    pathname === "/admin" || pathname.startsWith("/admin/")
      ? defaultDocument
      : await getSiteDocument();
  return {
    ...baseMetadata,
    title: {
      default: replaceCopy("SEEN ABAYAS | Made to Be Seen.", document),
      template: `%s | ${replaceCopy("SEEN ABAYAS", document)}`,
    },
    description: replaceCopy(baseMetadata.description!, document),
    icons: { icon: replaceMedia("/images/brand/logo.webp", document) },
  };
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Nonces must be rendered per request rather than reused in a static page.
  const requestHeaders = await headers();
  const adminPath = requestHeaders.get("x-seen-pathname") || "";
  const live = !adminPath.startsWith("/admin") &&
    (environment.catalog.source === "supabase" || process.env.CMS_SOURCE === "supabase");
  const [document, state] = await Promise.all([
    adminPath === "/admin" || adminPath.startsWith("/admin/") ? defaultDocument : getSiteDocument(),
    live ? getStorefrontState().catch(() => ({ revision: "unavailable" })) : null,
  ]);

  return (
    <html lang="en-GB" className={`${inter.variable} ${cormorant.variable}`}>
      <body id="home">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <ContentProvider document={document}>
          <BagProvider
            development={environment.catalog.source === "development"}
          >
            <StorefrontShell>{children}</StorefrontShell>
            {state && <StorefrontSync revision={state.revision} />}
          </BagProvider>
        </ContentProvider>
      </body>
    </html>
  );
}
