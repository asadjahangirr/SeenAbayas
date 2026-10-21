import { z } from "zod";
import { isSupabaseServerKey } from "../payments/config.mjs";

export const contactFieldsSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100, "Please keep your name under 100 characters.").regex(/^[^\r\n\u0000-\u001f\u007f]+$/, "Please enter a valid name."),
  email: z.email("Please enter a valid email address.").max(254),
  phone: z.string().trim().min(7, "Please enter a phone number.").max(40).regex(/^\+?[\d\s().-]+$/, "Please enter a UK or international phone number.").refine((value) => { const digits = value.replace(/\D/g, ""); return digits.length >= 7 && digits.length <= 15; }, "Please use a phone number with 7 to 15 digits."),
  message: z.string().trim().min(10, "Please include a little more detail (at least 10 characters).").max(5000, "Please keep your message under 5,000 characters.").refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Please remove unsupported characters."),
});

export const contactRequestSchema = contactFieldsSchema.extend({
  website: z.string().max(200),
  verificationToken: z.string().max(2048),
  requestId: z.uuid(),
  submittedAt: z.iso.datetime(),
}).strict();

export type ContactFields = z.infer<typeof contactFieldsSchema>;
export type ContactRequest = z.infer<typeof contactRequestSchema>;
export type ContactConfig = { delivery: "inbox" } | { delivery: "email"; apiKey: string; from: string; siteKey: string; turnstileSecret: string; recipient?: string };

export class ContactDeliveryError extends Error {
  constructor(message: string, public readonly status: 409 | 429 | 503 = 503) { super(message); }
}

export function readContactConfig(values: Record<string, string | undefined>): ContactConfig | null {
  const delivery = values.CONTACT_DELIVERY || "inbox";
  if (delivery === "inbox") {
    const backend = z.object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      SUPABASE_SECRET_KEY: z.string().refine(value => value.trim() === value && isSupabaseServerKey(value)),
    }).safeParse(values);
    if (!backend.success) return null;
    const url = new URL(backend.data.NEXT_PUBLIC_SUPABASE_URL);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) return null;
    return { delivery };
  }
  if (delivery !== "email") return null;
  const email = z.object({ RESEND_API_KEY: z.string().regex(/^re_[A-Za-z0-9_-]{10,}$/), CONTACT_FROM_EMAIL: z.email(), CONTACT_TURNSTILE_SITE_KEY: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/), CONTACT_TURNSTILE_SECRET_KEY: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/) }).safeParse(values);
  return email.success ? { delivery, apiKey: email.data.RESEND_API_KEY, from: email.data.CONTACT_FROM_EMAIL, siteKey: email.data.CONTACT_TURNSTILE_SITE_KEY, turnstileSecret: email.data.CONTACT_TURNSTILE_SECRET_KEY } : null;
}
