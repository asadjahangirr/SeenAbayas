import { getSiteDocument } from "@/lib/cms/server";
import { deliveryThresholdFor } from "@/lib/cms/model";
import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";

import { BusinessDetails, PolicyPage } from "@/components/content/policy-page";
import { policyRobots } from "@/lib/policies";

const baseMetadata: Metadata = { title: "Terms & Conditions", description: "Draft SEEN ABAYAS website and sale information, including preview ordering status, delivery and consumer cancellation rights.", robots: policyRobots };

export default async function TermsPage() {
  const document = await getSiteDocument();
  const deliveryThreshold = deliveryThresholdFor(document);
  return <PolicyPage title="Terms & Conditions" category="Store information" introduction={<p><Copy text={"Please read this draft alongside our delivery, returns and privacy information. Final sale terms and business details will be confirmed before online ordering opens."} /></p>} sections={[
    { id: "seller", title: "Seller details", content: <><p><Copy text={"The storefront trades under the SEEN ABAYAS brand. The legal trading name and postal address are awaiting confirmation."} /></p><BusinessDetails /></> },
    { id: "ordering", title: "Preview and ordering", content: <><p><Copy text={"The website supports browsing, a shopping bag and a checkout review preview. Real-money payments and commercial order placement are not available. Sandbox checkout may be enabled for testing: it saves private test orders and temporarily reserves stock, without a purchase contract or dispatch. Adding a piece or reviewing your details does not reserve stock, take payment or create a purchase contract."} /></p><p><Copy text={"Final ordering steps, how errors can be corrected and when an order is accepted will be explained before purchasing is enabled. These draft pages do not indicate that a preview selection has been accepted as an order."} /></p></> },
    { id: "products", title: "Products and sizing", content: <><p><Copy text={"Product photography shows the supplied designs. Colour appearance may vary between screens. Please check the specific design's confirmed description, measurements and available sizes before purchasing."} /></p><p><Copy text={"Sizes and quantities shown in the development collection are temporary. The "} /><Link href="/size-guide"><Copy text={"Size Guide"} /></Link><Copy text={" explains how to measure and labels its reference conversions clearly; it is not a confirmed garment size chart."} /></p></> },
    { id: "prices-payments", title: "Prices and payments", content: <><p><Copy text={"Displayed collection prices use pounds sterling (GBP). Preview prices are for review while the catalogue is being completed. VAT registration and tax treatment are being confirmed with the business."} /></p><p><Copy text={"Live payments are not enabled. Test checkout uses sandbox totals without charging real money. The final commercial payable total, any applicable taxes, delivery costs and available payment methods will be disclosed before payment. Requested payment options are subject to merchant activation and eligibility; an option is available only when shown at the active checkout."} /></p></> },
    { id: "delivery", title: "Delivery", content: <p><Copy text={"Royal Mail is the intended delivery partner. Dispatch times, charges, destinations and available services remain subject to confirmation. Read "} /><Link href="/shipping-delivery"><Copy text={"Shipping & Delivery"} /></Link><Copy text={" for current delivery information"} />{document.commerce.freeDeliveryEnabled && <><Copy text={", including complimentary standard UK delivery on eligible orders of "} /><Copy text={deliveryThreshold} /><Copy text={" or more"} /></>}<Copy text={"."} /></p> },
    { id: "returns", title: "Cancellations, returns and faulty items", content: <><p><Copy text={"Our supplied "} /><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges policy"} /></Link><Copy text={" explains exchanges, eligible online cancellations, refunds and faulty or incorrect items."} /></p><p><Copy text={"For eligible online purchases, you can notify us of cancellation within 14 days of receiving the goods and then have a further 14 days to return them. You do not have to give a reason or accept an exchange instead of an eligible refund."} /></p><p><Copy text={"The voluntary exchange conditions do not remove statutory cancellation or faulty-goods rights. You can email a clear cancellation statement or use the optional "} /><Link href="/returns-exchanges#cancellation-form"><Copy text={"cancellation form"} /></Link><Copy text={". Nothing on this page excludes rights that cannot lawfully be excluded."} /></p></> },
    { id: "website", title: "Using the website", content: <p><Copy text={"Please use the site lawfully. Do not attempt to compromise its security, misuse forms or interfere with other visitors. If you find an error or need help accessing a page, contact our team."} /></p> },
    { id: "privacy-contact", title: "Privacy and questions", content: <p><Copy text={"Our "} /><Link href="/privacy-policy"><Copy text={"Privacy Policy"} /></Link><Copy text={" and "} /><Link href="/cookie-policy"><Copy text={"Cookie Policy"} /></Link><Copy text={" explain the current preview's information handling. Visit "} /><Link href="/contact"><Copy text={"Contact Us"} /></Link><Copy text={" with any questions about these terms."} /></p> },
  ]} />;
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
