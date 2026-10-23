
import { deliveryThresholdFor } from "@/lib/cms/model";
import { getSiteDocument } from "@/lib/cms/server";

import { CmsAnchor } from "@/components/cms/anchor";
import { pageMetadata } from "@/lib/cms/metadata";
import { getPolicySettings } from "@/lib/cms/policies";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";
import { ArrowUpRight } from "lucide-react";

import { PolicyPage } from "@/components/content/policy-page";
import { store } from "@/config/store";
import { formatGbp } from "@/lib/money";
import { policyRobots } from "@/lib/policies";

const baseMetadata: Metadata = { title: "Shipping & Delivery", description: "SEEN ABAYAS delivery information, planned Royal Mail services, complimentary UK delivery from £80 and tracking help.", robots: policyRobots };

export default async function ShippingPage() {
  const policySettings = await getPolicySettings();
  const delivery = policySettings.delivery;
  const document = await getSiteDocument();
  const deliveryThreshold = deliveryThresholdFor(document);
  return <PolicyPage title="Shipping & Delivery" introduction={<p><Copy text={"At SEEN ABAYAS, we want your shopping experience to be as seamless as possible. We aim to deliver your order safely and efficiently through our selected Royal Mail delivery services."} /></p>} sections={[
    { id: "processing", title: "Order processing", content: <><p><Copy text={delivery.dispatchWindow || "Our dispatch processing time is being confirmed before ordering opens."} /></p><p><Copy text={"Processing is the time needed to prepare an order. Courier delivery estimates begin after dispatch and are separate from processing time."} /></p></> },
    { id: "standard-delivery", title: "Standard UK delivery", content: <><p><Copy text={"Royal Mail Tracked 48 is our planned standard UK service. Available services depend on the delivery address."} /></p><dl className="policy-facts"><div><dt><Copy text={"Delivery charge"} /></dt><dd><Copy text={document.shipping.mode === "royal_mail_olp" ? "Calculated at checkout for your parcel and delivery address" : delivery.standardChargePence === null ? "To be confirmed before ordering opens" : formatGbp(delivery.standardChargePence)} /></dd></div><div><dt><Copy text={"Delivery aim"} /></dt><dd><Copy text={delivery.standardDeliveryAim || "To be confirmed for the available service and destination"} /></dd></div></dl><p><Copy text={"Tracked services have delivery aims rather than guaranteed arrival times. See "} /><CmsAnchor href="https://www.royalmail.com/sending/uk/tracked-48" rel="noreferrer"><Copy text={"Royal Mail Tracked 48 service information"} /></CmsAnchor><Copy text={"."} /></p></> },
    { id: "express-delivery", title: "Express UK delivery", content: <><p><Copy text={delivery.expressAvailable === false ? "Express delivery is not currently offered." : "Royal Mail Tracked 24 is our planned express option, subject to availability for your address."} /></p>{delivery.expressAvailable !== false && <dl className="policy-facts"><div><dt><Copy text={"Availability"} /></dt><dd><Copy text={delivery.expressAvailable === null ? "To be confirmed" : "Available for eligible destinations"} /></dd></div><div><dt><Copy text={"Delivery charge"} /></dt><dd><Copy text={document.shipping.mode === "royal_mail_olp" ? "Calculated at checkout for your parcel and delivery address" : delivery.expressChargePence === null ? "To be confirmed" : formatGbp(delivery.expressChargePence)} /></dd></div><div><dt><Copy text={"Delivery aim"} /></dt><dd><Copy text={delivery.expressDeliveryAim || "To be confirmed for the available service and destination"} /></dd></div></dl>}<p><Copy text={"Read "} /><CmsAnchor href="https://www.royalmail.com/sending/uk/tracked-24" rel="noreferrer"><Copy text={"Royal Mail Tracked 24 service information"} /></CmsAnchor><Copy text={" for its current delivery aims and postcode exceptions."} /></p></> },
    { id: "complimentary-delivery", title: `Complimentary delivery from ${deliveryThreshold}`, content: !document.commerce.freeDeliveryEnabled ? <p>Complimentary delivery is not currently offered. See the standard delivery charges above.</p> : <><p><Copy text={"Enjoy complimentary standard UK delivery on orders of "} /><Copy text={deliveryThreshold} /><Copy text={" or more."} /></p><p><Copy text={"The eligible merchandise subtotal must be at least "} /><Copy text={deliveryThreshold} /><Copy text={". An order of exactly "} /><Copy text={deliveryThreshold} /><Copy text={" qualifies. This offer applies to standard UK delivery; an express upgrade is separate."} /></p></> },
    { id: "destinations", title: "Delivery destinations", content: <><p><Copy text={delivery.destinations || "Eligible UK destinations, including Northern Ireland, islands and postcode restrictions, are being confirmed."} /></p><p><Copy text={delivery.internationalAvailability || "International delivery availability has not been confirmed. Please contact us before arranging delivery outside the UK."} /></p><p><Copy text={"Delivery services and the full charge will be disclosed before payment when ordering opens."} /></p></> },
    { id: "tracking", title: "Order tracking", content: <><p><Copy text={"Once your order has been dispatched, we will provide tracking information where available so you can follow your delivery."} /></p><p><Copy text={"You can enter a Royal Mail tracking number using the carrier's tracking service. Automated tracking and dispatch notifications are not active in this preview."} /></p><CmsAnchor className="text-link" href="https://www.royalmail.com/track-your-item" rel="noreferrer"><Copy text={"Track your Royal Mail item"} /><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor></> },
    { id: "delays", title: "Delivery delays", content: <p><Copy text={"If a parcel is delayed or tracking appears incorrect, contact us with your order reference and tracking number. We will help investigate with the carrier. Delivery estimates can be affected by local restrictions and service disruption."} /></p> },
    { id: "address", title: "Incorrect delivery address", content: <p><Copy text={"Please check your address carefully before payment. If you notice an error, contact us promptly. We will confirm whether an address can be amended; a change may not be possible after dispatch."} /></p> },
    { id: "delivery-help", title: "Delivery enquiries", content: <p><Copy text={"For delivery enquiries, please contact "} /><CmsAnchor href={`mailto:${store.supportEmail}`}><Copy text={store.supportEmail} /></CmsAnchor><Copy text={" or visit "} /><Link href="/contact"><Copy text={"Contact Us"} /></Link><Copy text={". For return instructions, read our "} /><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges policy"} /></Link><Copy text={"."} /></p> },
  ]} />;
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
