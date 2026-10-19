"use client";
import { createContext, useContext, type ReactNode } from "react";
import {
  defaultDocument,
  replaceCopy,
  type SiteDocument,
} from "@/lib/cms/model";

const ContentContext = createContext<SiteDocument>(defaultDocument);
const PreviewContext = createContext(false);
export function ContentProvider({
  document,
  children,
  preview = false,
}: {
  document: SiteDocument;
  children: ReactNode;
  preview?: boolean;
}) {
  return (
    <PreviewContext value={preview}>
      <ContentContext value={document}>{children}</ContentContext>
    </PreviewContext>
  );
}
export function useSiteDocument() {
  return useContext(ContentContext);
}
export function useContentPreview() {
  return useContext(PreviewContext);
}
// No wrapper element: headings, links, inline emphasis and layouts retain their semantics.
export function Copy({ text }: { text: ReactNode }) {
  const document = useSiteDocument();
  return <>{typeof text === "string" ? replaceCopy(text, document) : text}</>;
}
