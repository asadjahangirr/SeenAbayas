import { z } from "zod";

export const contactFieldsSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(100, "Please keep your name under 100 characters.").regex(/^[^\r\n\u0000-\u001f\u007f]+$/, "Please enter a valid name."),
  email: z.email("Please enter a valid email address.").max(254),
  phone: z.string().trim().min(7, "Please enter a phone number.").max(40).regex(/^\+?[\d\s().-]+$/, "Please enter a UK or international phone number.").refine((value) => { const digits = value.replace(/\D/g, ""); return digits.length >= 7 && digits.length <= 15; }, "Please use a phone number with 7 to 15 digits."),
  message: z.string().trim().min(10, "Please include a little more detail (at least 10 characters).").max(5000, "Please keep your message under 5,000 characters.").refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), "Please remove unsupported characters."),
});

export const contactRequestSchema = contactFieldsSchema.extend({
  website: z.string().max(200),
  verificationToken: z.string().min(1).max(2048),
  requestId: z.uuid(),
  submittedAt: z.iso.datetime(),
}).strict();

export type ContactFields = z.infer<typeof contactFieldsSchema>;
export type ContactRequest = z.infer<typeof contactRequestSchema>;
export type ContactConfig = { apiKey: string; from: string; siteKey: string; turnstileSecret: string; recipient?: string };

export function readContactConfig(values: Record<string, string | undefined>): ContactConfig | null {
  const parsed = z.object({
    RESEND_API_KEY: z.string().regex(/^re_[A-Za-z0-9_-]{10,}$/),
    CONTACT_FROM_EMAIL: z.email(),
    CONTACT_TURNSTILE_SITE_KEY: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
    CONTACT_TURNSTILE_SECRET_KEY: z.string().regex(/^[A-Za-z0-9_-]{10,200}$/),
  }).safeParse(values);
  if (!parsed.success) return null;
  return { apiKey: parsed.data.RESEND_API_KEY, from: parsed.data.CONTACT_FROM_EMAIL, siteKey: parsed.data.CONTACT_TURNSTILE_SITE_KEY, turnstileSecret: parsed.data.CONTACT_TURNSTILE_SECRET_KEY };
}
