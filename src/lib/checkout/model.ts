import { z } from "zod";
import {
  parseBagLines,
  type BagQuote,
  type BagRequestLine,
} from "@/lib/bag/model";
import type { SiteDocument } from "@/lib/cms/model";
import { settingsSchema } from "@/lib/policies";

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(max, `Keep your ${label} within ${max} characters.`);
export const checkoutDetailsSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Enter your email address.")
      .max(254)
      .pipe(z.email("Enter a valid email address.")),
    firstName: requiredText("first name", 80),
    lastName: requiredText("last name", 80),
    phone: z
      .string()
      .trim()
      .max(32)
      .refine(
        (v) =>
          !v || (/^\+?[\d ()-]+$/.test(v) && v.replace(/\D/g, "").length >= 7),
        "Enter a valid phone number or leave it blank.",
      ),
    addressLine1: requiredText("address", 150),
    addressLine2: z.string().trim().max(150),
    city: requiredText("town or city", 100),
    postcode: z
      .string()
      .trim()
      .max(12)
      .transform((v) => v.toUpperCase().replace(/\s/g, ""))
      .refine(
        (v) =>
          /^(?:GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(v) &&
          !/^(GY|JE|IM)/.test(v),
        "Enter a UK postcode, for example SW1A 1AA.",
      )
      .transform((v) => `${v.slice(0, -3)} ${v.slice(-3)}`),
    country: z.literal("GB", {
      error: "This checkout preview supports UK addresses.",
    }),
  })
  .strict();

export type CheckoutDetails = z.infer<typeof checkoutDetailsSchema>;
export type CheckoutFieldErrors = Partial<
  Record<keyof CheckoutDetails, string>
>;
export const emptyCheckoutDetails: CheckoutDetails = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postcode: "",
  country: "GB",
};
export const checkoutReviewRequestSchema = z
  .object({
    details: checkoutDetailsSchema,
    shippingMethod: z.enum(["standard", "express"]),
    lines: z.unknown().transform((value, ctx) => {
      const lines = parseBagLines(value);
      if (!lines?.length) {
        ctx.addIssue({
          code: "custom",
          message: "Add an available piece to your bag first.",
        });
        return z.NEVER;
      }
      return lines;
    }),
  })
  .strict();

export type CheckoutDelivery = {
  id: "standard" | "express";
  label: string;
  chargePence: number | null;
  deliveryAim: string | null;
};
export type CheckoutReview = {
  mode: "preview" | "test";
  currency: "GBP";
  bag: BagQuote;
  details: CheckoutDetails;
  delivery: CheckoutDelivery;
  estimatedTotalPence: number | null;
  taxStatus: "unconfirmed";
  paymentAvailable: boolean;
  reviewFingerprint?: string;
};

export function checkoutDeliveryOptions(
  document: SiteDocument,
  bag: BagQuote,
): CheckoutDelivery[] {
  const { delivery } = settingsSchema.parse(document.policies);
  const options: CheckoutDelivery[] = [
    {
      id: "standard",
      label: "Standard delivery",
      chargePence: bag.freeDelivery ? 0 : delivery.standardChargePence,
      deliveryAim: delivery.standardDeliveryAim,
    },
  ];
  if (delivery.expressAvailable === true)
    options.push({
      id: "express",
      label: "Express delivery",
      chargePence: delivery.expressChargePence,
      deliveryAim: delivery.expressDeliveryAim,
    });
  return options;
}

export function makeCheckoutReview(
  document: SiteDocument,
  bag: BagQuote,
  details: CheckoutDetails,
  method: CheckoutDelivery["id"],
): CheckoutReview {
  if (!bag.lines.length || bag.lines.some((line) => line.issue || !line.piece))
    throw new Error(
      "Review the unavailable items in your bag before continuing.",
    );
  if (bag.subtotalPence < document.commerce.minimumOrderPence)
    throw new Error("Your selection is below the store's minimum order value.");
  const delivery = checkoutDeliveryOptions(document, bag).find(
    (option) => option.id === method,
  );
  if (!delivery)
    throw new Error(
      "That delivery option is no longer available. Please choose standard delivery.",
    );
  return {
    mode: "preview",
    currency: "GBP",
    bag,
    details,
    delivery,
    estimatedTotalPence:
      delivery.chargePence === null
        ? null
        : bag.subtotalPence + delivery.chargePence,
    taxStatus: "unconfirmed",
    paymentAvailable: false,
  };
}

export function checkoutRequestLines(bag: BagQuote): BagRequestLine[] {
  return bag.lines.map(({ variantId, quantity }) => ({ variantId, quantity }));
}
