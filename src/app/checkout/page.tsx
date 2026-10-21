import type { Metadata } from "next";
import { pageMetadata } from "@/lib/cms/metadata";
import { CheckoutPageContent } from "@/components/checkout/checkout-page";
import "./checkout.css";
import { readyPaymentMode } from "@/lib/payments/server";

const baseMetadata: Metadata = {
  title: "Checkout",
  description: "Review your SEEN ABAYAS selection and UK delivery details.",
  robots: { index: false, follow: false },
};
export default async function CheckoutPage() {
  return <CheckoutPageContent paymentMode={await readyPaymentMode()} />;
}
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(baseMetadata);
}
