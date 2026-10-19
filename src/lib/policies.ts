import { z } from "zod";
import settings from "@/data/store-settings.json";
import { store } from "@/config/store";

const text = z.string().trim().min(1).max(2500).nullable();
export const settingsSchema = z.object({
  review: z.object({ status: z.enum(["draft", "approved"]), reviewedOn: z.iso.date().nullable() }).strict(),
  business: z.object({ legalName: text, legalForm: z.enum(["sole-trader", "limited-company", "partnership", "other"]).nullable(), businessAddress: text, returnsAddress: text, registrationNumber: text, vatRegistered: z.boolean().nullable(), vatNumber: text, phone: text }).strict(),
  delivery: z.object({ dispatchWindow: text, standardChargePence: z.number().int().min(0).nullable(), standardDeliveryAim: text, expressAvailable: z.boolean().nullable(), expressChargePence: z.number().int().min(0).nullable(), expressDeliveryAim: text, destinations: text, internationalAvailability: text }).strict(),
  privacy: z.object({ enquiryLawfulBasis: text, securityLawfulBasis: text, enquiryRetention: text, hostingAndLogs: text, providersAndTransfers: text }).strict(),
}).strict();

export type StorePolicySettings = z.infer<typeof settingsSchema>;
const parsed = settingsSchema.safeParse(settings);
if (!parsed.success) throw new Error(`Invalid store policy settings: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
export const policySettings = parsed.data;

export function missingPolicySettings(value: StorePolicySettings): string[] {
  const missing: string[] = [];
  for (const field of ["legalName", "legalForm", "businessAddress", "returnsAddress", "vatRegistered"] as const) if (value.business[field] === null) missing.push(`business.${field}`);
  if (value.business.legalForm === "limited-company" && !value.business.registrationNumber) missing.push("business.registrationNumber");
  if (value.business.vatRegistered && !value.business.vatNumber) missing.push("business.vatNumber");
  for (const field of ["dispatchWindow", "standardChargePence", "standardDeliveryAim", "expressAvailable", "destinations", "internationalAvailability"] as const) if (value.delivery[field] === null) missing.push(`delivery.${field}`);
  if (value.delivery.expressAvailable) for (const field of ["expressChargePence", "expressDeliveryAim"] as const) if (value.delivery[field] === null) missing.push(`delivery.${field}`);
  for (const [field, content] of Object.entries(value.privacy)) if (content === null) missing.push(`privacy.${field}`);
  if (value.review.status !== "approved") missing.push("review.status");
  if (!value.review.reviewedOn) missing.push("review.reviewedOn");
  return missing;
}

export const policiesAreDraft = missingPolicySettings(policySettings).length > 0;
export const policyRobots = policiesAreDraft ? { index: false, follow: false } as const : undefined;

export function makeCancellationForm(value: StorePolicySettings = policySettings) {
  const draft = missingPolicySettings(value).length > 0;
  return [
    ...(draft ? ["PREVIEW — seller's legal details are still being confirmed. Online ordering is not yet available.", ""] : []),
    "MODEL CANCELLATION FORM",
    "Complete and return this form only if you wish to withdraw from the contract.", "",
    `To: ${value.business.legalName || "SEEN ABAYAS (legal trading name to be confirmed)"}`,
    `Business address: ${value.business.businessAddress || "To be confirmed before ordering opens"}`,
    `Email: ${store.supportEmail}`, "",
    "I/We (*) hereby give notice that I/We (*) cancel my/our (*) contract of sale of the following goods:",
    "Goods: ________________________________________________",
    "Ordered on (*) / received on (*): _____________________",
    "Name of consumer(s): _________________________________",
    "Address of consumer(s): _______________________________",
    "______________________________________________________",
    "Signature of consumer(s) (only if notified on paper): __",
    "Date: ________________________________________________",
    "(*) Delete as appropriate.", "",
    "Order reference (optional): __________________________",
    "You may also send a clear cancellation statement by email; you do not have to use this form.",
  ].join("\n");
}
