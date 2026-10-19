"use client";
import type { ComponentPropsWithRef } from "react";
import { useContentPreview, useSiteDocument } from "./content-provider";
export function CmsAnchor(props: ComponentPropsWithRef<"a">) {
  const preview = useContentPreview();
  const document = useSiteDocument();
  let href = props.href;
  if (href) {
    href = href.replaceAll(
      "info@seenabayas.co.uk",
      document.text["info@seenabayas.co.uk"] || "info@seenabayas.co.uk",
    );
    if (
      preview &&
      href.startsWith("/") &&
      !href.startsWith("/api/") &&
      !href.startsWith("/admin")
    )
      href = `/admin/preview${href === "/" ? "" : href}`;
  }
  return <a {...props} href={href} />;
}
