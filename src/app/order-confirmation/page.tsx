import type { Metadata } from "next";
import { pageMetadata } from "@/lib/cms/metadata";
import { OrderConfirmation } from "@/components/checkout/order-confirmation";
import "../checkout/checkout.css";
import "./confirmation.css";

const baseMetadata: Metadata = {
  title: "Payment status",
  robots: { index: false, follow: false },
  referrer: "same-origin",
};
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata(baseMetadata);
}
export default async function ConfirmationPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ order?: string }>;
}) {
  const params = await searchParams;
  return (
    <OrderConfirmation
      orderId={typeof params.order === "string" ? params.order : ""}
    />
  );
}
