
import { CmsAnchor } from "@/components/cms/anchor";
import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";
import { headers } from "next/headers";
import { ArrowUpRight } from "lucide-react";

import { PageBreadcrumb } from "@/components/content/page-breadcrumb";
import { ContactForm } from "@/components/content/contact-form";
import { Reveal } from "@/components/ui/reveal";
import { store } from "@/config/store";
import { getContactConfig } from "@/lib/contact/server";
import "../content.css";

const baseMetadata: Metadata = { title: "Contact Us", description: "Get in touch with SEEN ABAYAS for help with sizing, the collection or an order enquiry." };

export default async function ContactPage() {
  const configuration = getContactConfig();
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <div className="help-page container">
      <PageBreadcrumb current="Contact Us" />
      <Reveal className="help-page__heading"><p className="eyebrow"><Copy text={"Customer care"} /></p><h1><Copy text={"Get "} /><em><Copy text={"in Touch."} /></em></h1><p><Copy text={"We'd love to hear from you. Whether you have a question about an order, sizing or our collection, our customer care team is here to help."} /></p></Reveal>
      <div className="contact-layout">
        <Reveal className="contact-aside"><h2><Copy text={"Here to help."} /></h2><p><Copy text={"For sizing advice, include the design name and the measurements you would like to check. For an order enquiry, please include your order reference."} /></p><CmsAnchor className="text-link" href={`mailto:${store.supportEmail}`}><Copy text={store.supportEmail} /><ArrowUpRight size={16} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor><div className="contact-aside__links"><Link className="text-link" href="/size-guide"><Copy text={"Explore the size guide"} /><ArrowUpRight size={15} strokeWidth={1.3} aria-hidden="true" /></Link><Link className="text-link" href="/faqs"><Copy text={"Frequently asked questions"} /><ArrowUpRight size={15} strokeWidth={1.3} aria-hidden="true" /></Link></div></Reveal>
        <ContactForm siteKey={configuration?.siteKey} nonce={nonce} />
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
