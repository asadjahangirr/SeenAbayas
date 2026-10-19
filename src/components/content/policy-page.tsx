
import { CmsAnchor } from "@/components/cms/anchor";
import { getPolicySettings } from "@/lib/cms/policies";

import { Copy } from "@/components/cms/content-provider";
import Link from "@/components/cms/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { PageBreadcrumb } from "./page-breadcrumb";
import { Reveal } from "@/components/ui/reveal";
import { legalNavigation, store } from "@/config/store";
import { missingPolicySettings } from "@/lib/policies";
import "@/app/content.css";

export type PolicySection = { id: string; title: string; content: ReactNode };

export async function PolicyPage({ title, category = "Customer care", introduction, sections }: { title: string; category?: string; introduction: ReactNode; sections: PolicySection[] }) {
  const policySettings = await getPolicySettings();
  const policiesAreDraft = missingPolicySettings(policySettings).length > 0;
  const sectionLinks = sections.map((section) => <CmsAnchor key={section.id} href={`#${section.id}`}><Copy text={section.title} /><ArrowUpRight size={14} strokeWidth={1.3} aria-hidden="true" /></CmsAnchor>);
  return (
    <article className="policy-page container">
      <PageBreadcrumb current={title} />
      <Reveal className="policy-page__heading"><p className="eyebrow"><Copy text={category} /></p><h1><Copy text={title} /></h1><div className="policy-page__intro"><Copy text={introduction} /></div>{!policiesAreDraft && policySettings.review.reviewedOn && <p className="policy-page__date"><Copy text={"Last reviewed: "} /><Copy text={policySettings.review.reviewedOn} /></p>}</Reveal>
      {policiesAreDraft && <aside className="policy-notice" aria-label="Policy preview notice"><span><Copy text={"Preview policy"} /></span><p><Copy text={"Business details and delivery arrangements are being confirmed. This page is a draft for review; online ordering is not yet available."} /></p></aside>}
      <div className="policy-layout">
        <details className="policy-mobile-contents"><summary><Copy text={"On this page"} /><ChevronDown size={16} strokeWidth={1.3} aria-hidden="true" /></summary><nav aria-label="On this page"><Copy text={sectionLinks} /></nav></details>
        <nav className="policy-contents" aria-label="On this page"><p className="eyebrow"><Copy text={"On this page"} /></p><Copy text={sectionLinks} /></nav>
        <div className="policy-sections">{sections.map((section) => <section className="policy-section" key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}><Reveal><h2 id={`${section.id}-heading`}><Copy text={section.title} /></h2><div className="policy-prose"><Copy text={section.content} /></div></Reveal></section>)}</div>
      </div>
      <Reveal className="policy-contact"><div><p className="eyebrow"><Copy text={"Customer care"} /></p><h2><Copy text={"Here to help."} /></h2><p><Copy text={"For questions about this page, contact our team."} /></p></div><div><Link className="text-link" href="/contact"><Copy text={"Contact customer care"} /><ArrowUpRight size={17} strokeWidth={1.3} aria-hidden="true" /></Link><CmsAnchor href={`mailto:${store.supportEmail}`}><Copy text={store.supportEmail} /></CmsAnchor></div></Reveal>
      <nav className="policy-related" aria-label="Related policies"><Link href="/shipping-delivery"><Copy text={"Shipping & Delivery"} /></Link><Link href="/returns-exchanges"><Copy text={"Returns & Exchanges"} /></Link>{legalNavigation.map((item) => <Link key={item.href} href={item.href}><Copy text={item.label} /></Link>)}</nav>
    </article>
  );
}

export async function BusinessDetails() {
  const policySettings = await getPolicySettings();
  const business = policySettings.business;
  return <dl className="policy-facts"><div><dt><Copy text={"Brand"} /></dt><dd><Copy text={store.name} /></dd></div><div><dt><Copy text={"Legal trading name"} /></dt><dd><Copy text={business.legalName || "To be confirmed before ordering opens"} /></dd></div><div><dt><Copy text={"Business address"} /></dt><dd className="policy-address"><Copy text={business.businessAddress || "To be confirmed before ordering opens"} /></dd></div><div><dt><Copy text={"Email"} /></dt><dd><CmsAnchor href={`mailto:${store.supportEmail}`}><Copy text={store.supportEmail} /></CmsAnchor></dd></div>{business.phone && <div><dt><Copy text={"Telephone"} /></dt><dd><Copy text={business.phone} /></dd></div>}{business.registrationNumber && <div><dt><Copy text={"Company registration"} /></dt><dd><Copy text={business.registrationNumber} /></dd></div>}{business.vatRegistered && business.vatNumber && <div><dt><Copy text={"VAT registration"} /></dt><dd><Copy text={business.vatNumber} /></dd></div>}</dl>;
}
