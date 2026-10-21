import { z } from "zod";

export const ownerOrderInbox = "info@seenabayas.co.uk";
export const emailKinds = ["customer_confirmation", "owner_notification"] as const;
export type EmailKind = (typeof emailKinds)[number];
const money = z.number().int().nonnegative().max(9_999_999_999);
export const emailPurchaseSchema = z.object({
  id: z.uuid(),
  order_number: z.string().regex(/^SEEN-(?:T-)?[A-Z0-9]{12}$/),
  is_test: z.boolean(),
  currency: z.literal("gbp"),
  confirmed_at: z.iso.datetime({ offset: true }),
  details: z.object({
    email: z.email().max(254), firstName: z.string().max(80), lastName: z.string().max(80),
    recipientName: z.string().max(150).optional(), phone: z.string().max(32),
    addressLine1: z.string().min(1).max(150), addressLine2: z.string().max(150),
    city: z.string().min(1).max(100), postcode: z.string().max(12), country: z.literal("GB"),
  }),
  delivery: z.object({ label: z.string().max(100), carrier: z.string().max(100) }),
  items: z.array(z.object({
    name: z.string().min(1).max(200), design_reference: z.string().max(100),
    size: z.string().min(1).max(100), quantity: z.number().int().min(1).max(10), unit_price_pence: money,
  })).min(1).max(20),
  subtotal_pence: money, delivery_pence: money, tax_pence: money, total_pence: money,
}).refine(o => o.items.reduce((sum, i) => sum + i.quantity * i.unit_price_pence, 0) === o.subtotal_pence &&
  o.subtotal_pence + o.delivery_pence + o.tax_pence === o.total_pence, "Purchase totals must match");
export type EmailPurchase = z.infer<typeof emailPurchaseSchema>;
export type OrderEmailConfig = { apiKey: string; from: string; origin: string; mode: "test" | "live"; testRecipient?: string };

export function orderEmailConfiguration(values: Record<string, string | undefined>) {
  const issues: string[] = [];
  if (values.ORDER_EMAILS_ENABLED !== "true") issues.push("ORDER_EMAILS_ENABLED");
  if (values.PAYMENTS_MODE !== "live" && values.PAYMENTS_MODE !== "test") issues.push("PAYMENTS_MODE");
  if (!/^re_[A-Za-z0-9_-]{10,}$/.test(values.RESEND_API_KEY || "")) issues.push("RESEND_API_KEY");
  if (!z.email().safeParse(values.ORDER_FROM_EMAIL).success) issues.push("ORDER_FROM_EMAIL");
  let origin = "";
  try {
    const url = new URL(values.NEXT_PUBLIC_SITE_URL || "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) throw new Error();
    origin = url.origin;
  } catch { issues.push("NEXT_PUBLIC_SITE_URL"); }
  if (values.ORDER_EMAIL_TEST_RECIPIENT && !z.email().safeParse(values.ORDER_EMAIL_TEST_RECIPIENT).success)
    issues.push("ORDER_EMAIL_TEST_RECIPIENT");
  const config: OrderEmailConfig | null = issues.length ? null : {
    apiKey: values.RESEND_API_KEY!, from: values.ORDER_FROM_EMAIL!, origin,
    mode: values.PAYMENTS_MODE as "test" | "live",
    testRecipient: values.ORDER_EMAIL_TEST_RECIPIENT || undefined,
  };
  return { config, issues };
}

export type EmailMessage = {
  from: string; to: string[]; reply_to: string; subject: string; html: string; text: string;
  tags: { name: string; value: string }[];
};
export type EmailClaim = {
  id: string; kind: EmailKind; claim_token: string; snapshot: unknown; message: EmailMessage | null;
};
export type EmailStatus = {
  ready: boolean; counts: Record<string, number>;
  messages: { kind: EmailKind; state: string; attempts: number; acceptedAt: string | null; error: string | null }[];
};
