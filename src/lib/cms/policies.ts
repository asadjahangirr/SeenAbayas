import "server-only";
import { getSiteDocument } from "./server";
import { settingsSchema } from "@/lib/policies";
export async function getPolicySettings() {
  return settingsSchema.parse((await getSiteDocument()).policies);
}
