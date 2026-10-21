import { createContactHandler } from "@/lib/contact/handler";
import { getContactConfig } from "@/lib/contact/server";
import { storeVerifiedEnquiry } from "@/lib/admin/inbox";
import { getSiteDocument } from "@/lib/cms/server";
import { z } from "zod";

export const runtime = "nodejs";
const handleContact = createContactHandler();

export async function POST(request: Request) {
  const config = getContactConfig();
  if (config?.delivery === "email") {
    const address = (await getSiteDocument()).text["info@seenabayas.co.uk"] || "info@seenabayas.co.uk";
    config.recipient = z.email().parse(address);
  }
  return handleContact(request, config, fetch, data => storeVerifiedEnquiry(data, config?.delivery === "inbox", request));
}
