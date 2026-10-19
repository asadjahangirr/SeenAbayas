"use client";
import Image, { type ImageProps } from "next/image";
import { useSiteDocument } from "./content-provider";
import { replaceCopy, replaceMedia } from "@/lib/cms/model";
export default function CmsImage(props: ImageProps) {
  const document = useSiteDocument();
  const src =
    typeof props.src === "string"
      ? replaceMedia(props.src, document)
      : props.src;
  return (
    <Image
      {...props}
      src={src}
      alt={replaceCopy(props.alt, document)}
      unoptimized={
        props.unoptimized ||
        (typeof src === "string" && src.startsWith("/api/media/"))
      }
    />
  );
}
