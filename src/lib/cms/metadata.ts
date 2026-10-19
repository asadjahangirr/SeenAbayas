import "server-only";
import type { Metadata } from "next";
import { getSiteDocument } from "./server";
import { replaceCopy } from "./model";
export async function pageMetadata(base: Metadata): Promise<Metadata> {
  const document = await getSiteDocument();
  return {
    ...base,
    // Omit absent fields so Next can inherit the layout's title/description.
    ...(typeof base.title === "string"
      ? { title: replaceCopy(base.title, document) }
      : {}),
    ...(base.description
      ? { description: replaceCopy(base.description, document) }
      : {}),
  };
}
