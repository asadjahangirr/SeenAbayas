
import { deliveryThresholdFor } from "@/lib/cms/model";
import { getSiteDocument } from "@/lib/cms/server";

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
  const deliveryThreshold = deliveryThresholdFor(document);
  const groups = [
    { id: "ordering", title: "Ordering", questions: [
      { question: "How do I place an order?", answer: <><Copy text={"You can explore the "} /><Link href="/collection"><Copy text={"collection"} /></Link><Copy text={", select an available size on a product page and add it to your bag. You can review your contact and delivery details in the checkout preview. Reviewing does not place an order or reserve stock. If test payment is enabled, continuing creates a private sandbox checkout with a temporary reservation. It does not make a real purchase."} /></> },
      { question: "Can I change or cancel an order?", answer: <><Copy text={"For an existing order enquiry, "} /><Link href="/contact"><Copy text={"contact our team"} /></Link><Copy text={" with your order reference. Our "} /><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges policy"} /></Link><Copy text={" explains eligible cancellation rights and includes an optional cancellation form. You do not have to accept an exchange instead of an eligible refund."} /></> },
      { question: "How can I contact the team?", answer: <><Copy text={"Visit "} /><Link href="/contact"><Copy text={"Contact Us"} /></Link><Copy text={" for our contact form and customer care email. Include the design name or order reference so we can help."} /></> },
    ] },
    { id: "sizing", title: "Sizing & fit", questions: [
      { question: "How do I choose the correct abaya size?", answer: <><Copy text={"Start with our "} /><Link href="/size-guide"><Copy text={"Size Guide"} /></Link><Copy text={" to understand garment length and how to measure. Compare the specific design's measurements, as silhouettes can vary. Preview sizes are temporary and need confirmation before purchase."} /></> },
      { question: "Where can I find garment measurements?", answer: <><Copy text={"Confirmed measurements will be listed with each design. The reference conversions in our "} /><Link href="/size-guide"><Copy text={"Size Guide"} /></Link><Copy text={" are not a confirmed garment size chart. Please ask us for design-specific measurements."} /></> },
      { question: "What if my chosen size is unavailable?", answer: <><Copy text={"Contact us with the design and size you are looking for. We can help with current availability; a restock date is only confirmed when we have one."} /></> },
    ] },
    { id: "delivery", title: "Delivery", questions: [
      { question: "Do you offer free delivery?", answer: !document.commerce.freeDeliveryEnabled ? <Copy text={"See Shipping & Delivery for current delivery charges."} /> : <><Copy text={"Complimentary standard UK delivery applies when the eligible merchandise subtotal is at least "} /><Copy text={deliveryThreshold} /><Copy text={". An order of exactly "} /><Copy text={deliveryThreshold} /><Copy text={" qualifies."} /></> },
      { question: "Which courier will deliver my order?", answer: <><Copy text={"Royal Mail is the planned UK delivery partner. Our "} /><Link href="/shipping-delivery"><Copy text={"Shipping & Delivery page"} /></Link><Copy text={" explains the planned services, tracking and details being confirmed before ordering opens."} /></> },
      { question: "When will my order be dispatched, and how can I track it?", answer: <><Copy text={"Dispatch times are still being confirmed. Once ordering and fulfilment are active, dispatch confirmation will include tracking details. For an existing order enquiry, please contact us with your order reference."} /></> },
    ] },
    { id: "returns", title: "Returns & exchanges", questions: [
      { question: "How do I request a return or exchange?", answer: <><Copy text={"Read our "} /><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges policy"} /></Link><Copy text={" and contact our team with your order reference and the item. Please obtain the correct return instructions before posting an item. No reason is required for an eligible online cancellation."} /></> },
      { question: "What if an item arrives faulty?", answer: <><Copy text={"Please contact us with your order reference, a description of the issue and photographs if available. Our team will review the issue and explain the next steps."} /></> },
    ] },
    { id: "payments", title: "Payments", questions: [
      { question: "Which payment methods do you accept?", answer: <><Copy text={"Real-money payments are not enabled. Test checkout supports cards, Apple Pay, Klarna and Clearpay where Stripe makes them available. No real money is charged during testing."} /></> },
      { question: "Will Apple Pay, Klarna or Clearpay be available?", answer: <><Copy text={"The store is being configured for Apple Pay, Klarna and Clearpay. Stripe shows eligible options for the account, customer, device and order; an enabled method is not guaranteed for every checkout. Real purchasing remains unavailable during testing."} /></> },
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
