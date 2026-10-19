import { z } from "zod";
import policyDefaults from "@/data/store-settings.json";

export const assetPath = z
  .string()
  .max(500)
  .refine(
    (v) =>
      (/^\/(?:images|videos)\/[a-zA-Z0-9_./-]+$/.test(v) &&
        !v.includes("..")) ||
      /^\/api\/media\/[a-f0-9-]+\.(?:webp|jpg|png|mp4)$/.test(v),
    "Select a local asset or an uploaded library file.",
  );
export const internalLink = z
  .string()
  .max(200)
  .regex(/^\/(?!\/)[a-zA-Z0-9/#?=&_-]*$/);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const mediaPages = [
  "/",
  "/collection",
  "/collection/*",
  "/our-story",
  "/contact",
  "/size-guide",
  "/faqs",
  "/shipping-delivery",
  "/returns-exchanges",
  "/privacy-policy",
  "/terms-conditions",
  "/cookie-policy",
  "/bag",
] as const;
export const mediaSectionSchema = z
  .object({
    id: z.uuid(),
    page: z
      .string()
      .refine(
        (value) =>
          (mediaPages as readonly string[]).includes(value) ||
          /^\/collection\/design-[0-9]{2,4}$/.test(value),
        "Choose a customer page.",
      ),
    position: z.enum(["before", "after"]),
    src: assetPath,
    poster: z
      .union([
        z.literal(""),
        assetPath.refine((path) => !path.endsWith(".mp4")),
      ])
      .default(""),
    alt: z.string().trim().min(1).max(300),
    caption: z.string().max(2000),
    aspect: z.enum(["natural", "landscape", "portrait", "square"]),
  })
  .strict();
export type MediaSection = z.infer<typeof mediaSectionSchema>;
export const siteDocumentSchema = z
  .object({
    text: z.record(z.string().max(3000), z.string().max(8000)),
    media: z.record(z.string().max(500), assetPath),
    sections: z.array(mediaSectionSchema).max(24).default([]),
    hero: z
      .object({
        videos: z.array(assetPath).min(1).max(8),
        poster: assetPath,
        ctaLink: internalLink.default("/collection"),
      })
      .strict(),
    appearance: z
      .object({
        ink: hex,
        paper: hex,
        accent: hex,
        motion: z.enum(["subtle", "editorial", "cinematic", "none"]),
        hover: z.enum(["lift", "magnetic", "sheen", "none"]),
      })
      .strict(),
    announcement: z
      .object({
        enabled: z.boolean(),
        text: z.string().trim().min(1).max(180),
        link: internalLink,
        background: hex.default("#171717"),
        ink: hex.default("#ffffff"),
        duration: z.number().int().min(15).max(90).default(48),
      })
      .strict(),
    commerce: z
      .object({
        freeDeliveryEnabled: z.boolean(),
        freeDeliveryThresholdPence: z.number().int().min(0).max(99999999),
        minimumOrderPence: z.number().int().min(0).max(99999999),
      })
      .strict(),
    featured: z.array(z.string().regex(/^design-[0-9]{2,4}$/)).max(8),
    policies: z.unknown(),
  })
  .strict();
export type SiteDocument = z.infer<typeof siteDocumentSchema>;
export const defaultDocument: SiteDocument = {
  text: {},
  media: {},
  sections: [],
  hero: {
    videos: ["/videos/home/hero.mp4"],
    poster: "/images/home/hero-poster.webp",
    ctaLink: "/collection",
  },
  appearance: {
    ink: "#171717",
    paper: "#ffffff",
    accent: "#8b6a49",
    motion: "editorial",
    hover: "sheen",
  },
  announcement: {
    enabled: true,
    text: "Complimentary UK delivery on orders over {threshold}",
    link: "/shipping-delivery",
    background: "#171717",
    ink: "#ffffff",
    duration: 48,
  },
  commerce: {
    freeDeliveryEnabled: true,
    freeDeliveryThresholdPence: 8000,
    minimumOrderPence: 0,
  },
  featured: ["design-01", "design-02", "design-03", "design-06"],
  policies: policyDefaults,
};

export function deliveryThresholdFor(document: SiteDocument) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(document.commerce.freeDeliveryThresholdPence / 100);
}
export function replaceCopy(value: string, document: SiteDocument) {
  return (
    Object.hasOwn(document.text, value) ? document.text[value] : value
  ).replaceAll(
    "info@seenabayas.co.uk",
    document.text["info@seenabayas.co.uk"] || "info@seenabayas.co.uk",
  );
}
export function replaceMedia(value: string, document: SiteDocument) {
  return Object.hasOwn(document.media, value) ? document.media[value] : value;
}
