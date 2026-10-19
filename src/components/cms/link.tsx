"use client";
import Link from "next/link";
import type { ComponentPropsWithRef } from "react";
import { useContentPreview, useSiteDocument } from "./content-provider";
export default function CmsLink(props: ComponentPropsWithRef<typeof Link>) {
  const preview = useContentPreview();
  const document = useSiteDocument();
  let href = props.href;
  if (typeof href === "string") {
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
  return (
    <Link
      {...props}
      href={href}
      prefetch={preview ? false : (props.prefetch ?? false)}
    />
  );
}
