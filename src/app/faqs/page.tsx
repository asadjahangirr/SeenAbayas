
import { deliveryThresholdFor } from "@/lib/cms/model";
import { getSiteDocument } from "@/lib/cms/server";
import { getCheckoutInformation } from "@/lib/checkout/information";

import { CmsAnchor } from "@/components/cms/anchor";
import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { PageBreadcrumb } from "@/components/content/page-breadcrumb";
import { Reveal } from "@/components/ui/reveal";
import "../content.css";

const baseMetadata: Metadata = { title: "Frequently Asked Questions", description: "Help with browsing the SEEN collection, abaya sizing, delivery and contacting customer care." };

export default async function FaqPage() {
  const document = await getSiteDocument();
  const { copy } = await getCheckoutInformation();
  const deliveryThreshold = deliveryThresholdFor(document);
  const groups = [
    { id: "ordering", title: "Ordering", questions: [
      { question: "How do I place an order?", answer: <><Copy text={"You can explore the "} /><Link href="/collection"><Copy text={"collection"} /></Link><Copy text={copy.ordering} /></> },
      { question: "Can I change or cancel an order?", answer: <><Copy text={"For an existing order enquiry, "} /><Link href="/contact"><Copy text={"contact our team"} /></Link><Copy text={" with your order reference. Our "} /><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges policy"} /></Link><Copy text={" explains eligible cancellation rights and includes an optional cancellation form. You do not have to accept an exchange instead of an eligible refund."} /></> },
      { question: "How can I contact the team?", answer: <><Copy text={"Visit "} /><Link href="/contact"><Copy text={"Contact Us"} /></Link><Copy text={" for our contact form and customer care email. Include the design name or order reference so we can help."} /></> },
    ] },
    { id: "sizing", title: "Sizing & fit", questions: [
      { question: "How do I choose the correct abaya size?", answer: <><Copy text={"Start with our "} /><Link href="/size-guide"><Copy text={"Size Guide"} /></Link><Copy text={" for the supplied length and suggested-height guidance. Check the available size options on the product page and ask our team for design-specific fit measurements before purchasing if you are unsure."} /></> },
      { question: "Where can I find garment measurements?", answer: <><Copy text={"Our "} /><Link href="/size-guide"><Copy text={"Size Guide"} /></Link><Copy text={" provides the supplied length references. For widths, sleeves or other design-specific measurements, please contact our team."} /></> },
      { question: "What if my chosen size is unavailable?", answer: <><Copy text={"Contact us with the design and size you are looking for. We can help with current availability; a restock date is only confirmed when we have one."} /></> },
    ] },
    { id: "delivery", title: "Delivery", questions: [
      { question: "Do you offer free delivery?", answer: !document.commerce.freeDeliveryEnabled ? <Copy text={"See Shipping & Delivery for current delivery charges."} /> : <><Copy text={"Complimentary standard UK delivery applies when the eligible merchandise subtotal is at least "} /><Copy text={deliveryThreshold} /><Copy text={". An order of exactly "} /><Copy text={deliveryThreshold} /><Copy text={" qualifies."} /></> },
      { question: "Which courier will deliver my order?", answer: <><Copy text={"Royal Mail is the planned UK delivery partner. Our "} /><Link href="/shipping-delivery"><Copy text={"Shipping & Delivery page"} /></Link><Copy text={" explains the available delivery information and any service details still being confirmed."} /></> },
      { question: "When will my order be dispatched, and how can I track it?", answer: <><Copy text={"See Shipping & Delivery for confirmed dispatch and service information. If you have been given a tracking number, use Royal Mail's tracking service. For help with an order or its tracking, contact our team with your order reference."} /></> },
    ] },
    { id: "returns", title: "Returns & exchanges", questions: [
      { question: "How do I request a return or exchange?", answer: <><Copy text={"Read our "} /><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges policy"} /></Link><Copy text={" and contact our team with your order reference and the item. Please obtain the correct return instructions before posting an item. No reason is required for an eligible online cancellation."} /></> },
      { question: "What if an item arrives faulty?", answer: <><Copy text={"Please contact us with your order reference, a description of the issue and photographs if available. Our team will review the issue and explain the next steps."} /></> },
    ] },
    { id: "payments", title: "Payments", questions: [
      { question: "Which payment methods do you accept?", answer: <Copy text={copy.methods} /> },
      { question: "Will Apple Pay, Klarna or Clearpay be available?", answer: <Copy text={copy.eligibility} /> },
    ] },
  ];
  return (
    <div className="help-page container">
      <PageBreadcrumb current="FAQs" />
      <Reveal className="help-page__heading"><p className="eyebrow"><Copy text={"Customer care"} /></p><h1><Copy text={"Frequently"} /><br /><em><Copy text={"Asked Questions."} /></em></h1><p><Copy text={"A little guidance on our collection, finding your fit and getting in touch."} /></p></Reveal>
      <div className="faq-layout">
        <nav className="faq-topics" aria-label="FAQ topics">{groups.map((group) => <CmsAnchor key={group.id} href={`#${group.id}`}><Copy text={group.title} /><ArrowUpRight size={15} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor>)}</nav>
        <div className="faq-groups">{groups.map((group) => <section className="faq-group" id={group.id} key={group.id} aria-labelledby={`${group.id}-title`}><Reveal><h2 id={`${group.id}-title`}><Copy text={group.title} /></h2>{group.questions.map((item) => <details className="faq-item" key={item.question}><summary><Copy text={item.question} /><Plus size={18} strokeWidth={1.2} aria-hidden="true" /></summary><div><Copy text={item.answer} /></div></details>)}</Reveal></section>)}</div>
      </div>
      <Reveal className="help-page__assistance"><h2><Copy text={"A question"} /><br /><em><Copy text={"of your own?"} /></em></h2><div><p><Copy text={"Our customer care team is here to help with the collection, sizing and order enquiries."} /></p><Link className="text-link" href="/contact"><Copy text={"Get in touch"} /><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></Link></div></Reveal>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
