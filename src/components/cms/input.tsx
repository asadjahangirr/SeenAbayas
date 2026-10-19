"use client";
import type { ComponentPropsWithRef } from "react";
import { useSiteDocument } from "./content-provider";
import { replaceCopy } from "@/lib/cms/model";
export function CmsInput(props: ComponentPropsWithRef<"input">) {
  const document = useSiteDocument();
  return (
    <input
      {...props}
      placeholder={
        props.placeholder ? replaceCopy(props.placeholder, document) : undefined
      }
      aria-label={
        props["aria-label"]
          ? replaceCopy(props["aria-label"], document)
          : undefined
      }
    />
  );
}
export function CmsTextarea(props: ComponentPropsWithRef<"textarea">) {
  const document = useSiteDocument();
  return (
    <textarea
      {...props}
      placeholder={
        props.placeholder ? replaceCopy(props.placeholder, document) : undefined
      }
      aria-label={
        props["aria-label"]
          ? replaceCopy(props["aria-label"], document)
          : undefined
      }
    />
  );
}
