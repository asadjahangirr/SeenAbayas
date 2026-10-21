import "server-only";
import { headers } from "next/headers";
import { readyPaymentMode } from "@/lib/payments/server";
import { checkoutPublicCopy } from "./public-copy";

export async function getCheckoutInformation() {
  const path = (await headers()).get("x-seen-pathname") || "";
  const mode = path.startsWith("/admin/preview") ? "preview" : await readyPaymentMode() || "preview";
  return { mode, copy: checkoutPublicCopy(mode) };
}
