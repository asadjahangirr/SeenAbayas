import { z } from "zod";
import { assetPath, siteDocumentSchema } from "@/lib/cms/model";
import { settingsSchema } from "@/lib/policies";
import { missingShippingSettings } from "@/lib/shipping/settings";
import type { StoreConnection } from "@/lib/storefront/model";

export const adminSections = [
  "dashboard",
  "products",
  "categories",
  "orders",
  "inbox",
  "finance",
  "coupons",
  "hero",
  "media",
  "content",
  "appearance",
  "settings",
  "history",
  "security",
] as const;
export type AdminSection = (typeof adminSections)[number];
export const sectionNames: Record<AdminSection, string> = {
  dashboard: "Overview",
  products: "Products & stock",
  categories: "Categories",
  orders: "Orders",
  inbox: "Inbox",
  finance: "Finance",
  coupons: "Coupons",
  hero: "Hero video",
  media: "Media library",
  content: "Website text",
  appearance: "Appearance & motion",
  settings: "Store settings",
  history: "History & activity",
  security: "Account & security",
};
const money = z.number().int().min(0).max(99_999_999);
const short = z.string().trim().max(150);
export const photoSchema = z
  .object({
    src: assetPath.refine(
      (path) => !path.endsWith(".mp4"),
      "Product photographs must be still images.",
    ),
    alt: z.string().trim().min(1).max(300),
    label: short,
  })
  .strict();
export const productSchema = z
  .object({
    id: z.uuid().optional(),
    design_reference: z.string().regex(/^design-[0-9]{2,4}$/),
    name: short,
    description: z.string().trim().max(2000),
    price_pence: money.nullable(),
    cost_pence: money.nullable(),
    status: z.enum(["draft", "published", "archived"]),
    details_confirmed: z.boolean(),
    sort_order: z.number().int().min(0).max(10000),
    photos: z.array(photoSchema).max(12),
    category: z.string().trim().max(100),
    tone: z.string().trim().max(80),
    variants: z
      .array(
        z
          .object({
            id: z.uuid().optional(),
            size_label: z.string().trim().min(1).max(50),
            sku: z.string().trim().max(80),
            active: z.boolean(),
            on_hand: z.number().int().min(0).max(1_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    const sizes = value.variants.map((v) => v.size_label.toLowerCase());
    if (new Set(sizes).size !== sizes.length)
      ctx.addIssue({ code: "custom", message: "Size labels must be unique." });
    if (
      value.status === "published" &&
      (!value.details_confirmed ||
        !value.name ||
        !value.description ||
        !value.price_pence ||
        !value.photos.length ||
        !value.variants.some((v) => v.active))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Confirm product details, a positive price, photography and at least one active size before publishing.",
      });
  });
export const categorySchema = z
  .object({
    name: short.min(1),
    slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
    description: z.string().max(1000),
    sort_order: z.number().int().min(0).max(10000),
  })
  .strict();
export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9_-]{3,40}$/),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1).max(99_999_999),
    min_subtotal_pence: money,
    active: z.boolean(),
    expires_at: z.iso.datetime().nullable(),
    usage_limit: z.number().int().min(1).max(1_000_000).nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.type === "percent" && v.value > 100)
      c.addIssue({ code: "custom", message: "Percentage cannot exceed 100." });
  });
export const expenseSchema = z
  .object({
    title: short.min(1),
    amount_pence: money.min(1),
    date: z.iso.date(),
    note: z.string().max(2000),
  })
  .strict();
const recordSchemas = {
  category: categorySchema,
  coupon: couponSchema,
  expense: expenseSchema,
  order: z
    .object({
      status: z.enum([
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "completed",
        "cancelled",
      ]),
      tracking: z.string().max(200),
      notes: z.string().max(2000),
    })
    .strict(),
  message: z
    .object({
      read: z.boolean(),
      archived: z.boolean(),
      notes: z.string().max(2000),
    })
    .strict(),
};
export type RecordKind = keyof typeof recordSchemas;
function contrast(a: string, b: string) {
  const luminance = (v: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(v.slice(i, i + 2), 16) / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const first = luminance(a),
    second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
export const recordRequestSchema = z
  .object({
    kind: z.enum(["category", "coupon", "expense", "order", "message"]),
    id: z.uuid().nullable(),
    version: z.number().int().min(0),
    data: z.unknown(),
  })
  .strict()
  .transform((v, ctx) => {
    const parsed = recordSchemas[v.kind].safeParse(v.data);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        message: parsed.error.issues.map((i) => i.message).join(" "),
      });
      return z.NEVER;
    }
    return { ...v, data: parsed.data };
  });
export const documentRequestSchema = z
  .object({
    document: siteDocumentSchema,
    version: z.number().int().min(0),
    publish: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.publish && v.document.shipping.mode === "royal_mail_olp") {
      const missing = missingShippingSettings(v.document.shipping);
      if (missing.length) ctx.addIssue({ code: "custom", message: `Complete Royal Mail setup before enabling carrier prices: ${missing.join(", ")}.` });
    }
    const policies = settingsSchema.safeParse(v.document.policies);
    if (!policies.success)
      ctx.addIssue({
        code: "custom",
        message: "Check the legal, delivery and privacy settings.",
      });
    if (
      !v.document.hero.videos.every((v) => v.endsWith(".mp4")) ||
      v.document.hero.poster.endsWith(".mp4")
    )
      ctx.addIssue({
        code: "custom",
        message: "Hero clips must be MP4 files with a still image poster.",
      });
    const email = v.document.text["info@seenabayas.co.uk"];
    if (email !== undefined && !z.email().safeParse(email).success)
      ctx.addIssue({
        code: "custom",
        message: "Customer care email must be a valid email address.",
      });
    if (contrast(v.document.appearance.ink, v.document.appearance.paper) < 4.5)
      ctx.addIssue({
        code: "custom",
        message:
          "Choose ink and paper colours with at least 4.5:1 contrast for readable text.",
      });
    if (
      contrast(
        v.document.announcement.ink,
        v.document.announcement.background,
      ) < 4.5
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose banner colours with at least 4.5:1 contrast.",
      });
    if (Object.values(v.document.media).some((src) => src.endsWith(".mp4")))
      ctx.addIssue({
        code: "custom",
        message: "Image replacements must be still images.",
      });
  });
export type AdminProduct = Omit<z.infer<typeof productSchema>, "variants"> & {
  id: string;
  updated_at: string;
  variants: (z.infer<typeof productSchema>["variants"][number] & {
    id: string;
    reserved: number;
    inventory_known?: boolean;
  })[];
};
export type AdminRecord = {
  id: string;
  kind: RecordKind;
  payload: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
};
export type AdminSnapshot = {
  connection?: StoreConnection;
  statistics?: {
    recordCount: number;
    orderCount: number;
    paidPence: number;
    expensePence: number;
  } | null;
  site: {
    version: number;
    draft: unknown;
    published: unknown;
    published_at: string | null;
  };
  products: AdminProduct[];
  records: AdminRecord[];
  history: { version: number; created_at: string }[];
  audit: {
    id: number;
    action: string;
    entity: string;
    entity_id: string;
    created_at: string;
  }[];
};
export function csvCell(value: unknown) {
  const s = String(value ?? "");
  return `"${(/^[\s]*[=+@-]/.test(s) ? "'" : "") + s.replaceAll('"', '""')}"`;
}
