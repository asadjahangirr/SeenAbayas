
import { CmsAnchor } from "@/components/cms/anchor";
import { pageMetadata } from "@/lib/cms/metadata";

import { Copy } from "@/components/cms/content-provider";
import type { Metadata } from "next";
import Link from "@/components/cms/link";

import { BrowserStorageControls } from "@/components/content/browser-storage-controls";
import { PolicyPage } from "@/components/content/policy-page";
import { getContactConfig } from "@/lib/contact/server";
import { policyRobots } from "@/lib/policies";

const baseMetadata: Metadata = { title: "Cookie Policy", description: "SEEN ABAYAS browser storage and security information, with a control to clear your saved shopping bag.", robots: policyRobots };

export default function CookiePage() {
  const contactEnabled = Boolean(getContactConfig());
  return <PolicyPage title="Cookie Policy" category="Your browser choices" introduction={<p><Copy text={"This draft describes cookies and similar browser technologies used by the current storefront preview, including the shopping bag you choose to save."} /></p>} sections={[
    { id: "administration", title: "Private administration", content: <p><Copy text={"Administrators use necessary Supabase authentication cookies, including session cookies with names beginning sb- and temporary PKCE verification cookies for account recovery and email confirmation. Session cookies are HttpOnly, use SameSite=Lax and are Secure on the public HTTPS website. They are refreshed with the session and cleared on sign-out. Ordinary browsing does not require an administrator account. Clearing your saved shopping bag does not sign an administrator out."} /></p> },
    { id: "checkout", title: "Test checkout", content: <p><Copy text={"When test payment is enabled, reviewing checkout sets the necessary first-party seen_checkout_owner cookie for up to 30 days. It is a random browser ownership token, contains no contact or card details, uses HttpOnly and SameSite=Lax, and is Secure on HTTPS. It authorises private test-order access after returning from Stripe. Blocking or clearing it prevents access to those orders in that browser. Stripe-hosted Checkout uses its own payment and fraud-prevention technologies; no Stripe script is loaded by this storefront. Clearing your bag does not cancel a pending checkout or remove this cookie."} /></p> },
    { id: "technologies", title: "Cookies and similar technologies", content: <p><Copy text={"Cookies and browser storage can remember information on your device. This page covers local storage as well as cookies; using local storage does not make a technology exempt from privacy rules."} /></p> },
    { id: "saved-bag", title: "Your saved shopping bag", content: <><p><Copy text={"The storefront uses first-party local storage to remember product variant references and quantities in your bag. It does not save payment card details, your name, email or delivery address in those entries."} /></p><dl className="policy-facts"><div><dt><Copy text={"Storage names"} /></dt><dd><code><Copy text={"seen.bag.v1"} /></code><Copy text={" and, for sample products, "} /><code><Copy text={"seen.bag.v1.development"} /></code></dd></div><div><dt><Copy text={"Purpose"} /></dt><dd><Copy text={"Remembering the shopping bag you request"} /></dd></div><div><dt><Copy text={"Duration"} /></dt><dd><Copy text={"Until removed by you or your browser; there is currently no automatic expiry"} /></dd></div></dl><p><Copy text={"Standard and development bags use separate entries. You can clear both with the control below. Clearing one item from your bag removes that selection from the active saved bag."} /></p></> },
    { id: "security-checks", title: "Contact security checks", content: <><p><Copy text={contactEnabled ? "The contact form uses Cloudflare Turnstile to check for automated submissions." : "Contact sending is not yet configured. The Turnstile widget does not load while the form is unavailable."} /><Copy text={" When enabled, Turnstile processes browser and device signals for security. Its storage behaviour depends on the service and widget configuration; it is not an advertising feature."} /></p><p><Copy text={"Read the "} /><CmsAnchor href="https://www.cloudflare.com/turnstile-privacy-policy/" rel="noreferrer"><Copy text={"Cloudflare Turnstile Privacy Addendum"} /></CmsAnchor><Copy text={". Any hosting-level security cookies must also be recorded when the hosting environment is confirmed."} /></p></> },
    { id: "optional-tracking", title: "Analytics and advertising", content: <><p><Copy text={"The current storefront does not install analytics, advertising pixels or marketing tracking tools. Fonts and product images are served by the site."} /></p><p><Copy text={"If optional tracking is added, this page and its controls must be updated before it runs. Where consent is required, you must be able to decline optional tracking without losing access to the store."} /></p></> },
    { id: "storage-choices", title: "Manage your saved bag", content: <><BrowserStorageControls /><p><Copy text={"You can also inspect or remove this site's cookies and local storage in your browser's site-data settings. Blocking necessary storage can prevent your bag from being remembered between visits. This button does not clear third-party cookies or unrelated browser data."} /></p></> },
    { id: "more-information", title: "More information", content: <p><Copy text={"Read our "} /><Link href="/privacy-policy"><Copy text={"Privacy Policy"} /></Link><Copy text={" for personal information and contact choices. Hosting and security storage will be reviewed before launch so this policy reflects the final setup."} /></p> },
  ]} />;
}

export async function generateMetadata(): Promise<Metadata> { return pageMetadata(baseMetadata); }
