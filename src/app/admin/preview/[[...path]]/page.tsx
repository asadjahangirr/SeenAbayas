import { getAdminRenderAccess } from "@/lib/admin/auth";
import { redirect, notFound } from "next/navigation";
import { ContentProvider } from "@/components/cms/content-provider";
import { getSiteDocument } from "@/lib/cms/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StoreMotion } from "@/components/ui/store-motion";
import { PageMediaSections } from "@/components/cms/media-sections";
import type { CSSProperties, ComponentType } from "react";
const pages = {
  "/": () => import("@/app/page"),
  "/collection": () => import("@/app/collection/page"),
  "/bag": () => import("@/app/bag/page"),
  "/checkout": () => import("@/app/checkout/page"),
  "/order-confirmation": () => import("@/app/order-confirmation/page"),
  "/our-story": () => import("@/app/our-story/page"),
  "/contact": () => import("@/app/contact/page"),
  "/size-guide": () => import("@/app/size-guide/page"),
  "/faqs": () => import("@/app/faqs/page"),
  "/shipping-delivery": () => import("@/app/shipping-delivery/page"),
  "/returns-exchanges": () => import("@/app/returns-exchanges/page"),
  "/privacy-policy": () => import("@/app/privacy-policy/page"),
  "/terms-conditions": () => import("@/app/terms-conditions/page"),
  "/cookie-policy": () => import("@/app/cookie-policy/page"),
};
export default async function Preview({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  try {
    await getAdminRenderAccess();
  } catch {
    redirect("/admin/login");
  }
  const { path } = await params;
  const route = "/" + (path || []).join("/");
  const product = /^\/collection\/design-[0-9]{2,4}$/.test(route);
  if (!product && !(route in pages)) notFound();
  const module = await (product
    ? import("@/app/collection/[id]/page")
    : pages[route as keyof typeof pages]());
  const View = module.default as ComponentType<{
    params: Promise<{ id: string }>;
  }>;
  const document = await getSiteDocument();
  return (
    <ContentProvider document={document} preview>
      <div className="admin-preview-notice">
        Saved draft preview · Shopping is disabled.{" "}
        <a href="/admin">Return to workspace</a>
      </div>
      <div
        style={
          {
            "--foreground": document.appearance.ink,
            "--background": document.appearance.paper,
            "--seen-logo": `url("${document.media["/images/brand/seen-signature.svg"] || "/images/brand/seen-signature.svg"}")`,
          } as CSSProperties
        }
      >
        <SiteHeader />
        <PageMediaSections position="before" />
        <View params={Promise.resolve({ id: path?.[1] || "" })} />
        <PageMediaSections position="after" />
        <SiteFooter />
        <StoreMotion settings={document.appearance} />
      </div>
    </ContentProvider>
  );
}
