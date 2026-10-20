# Business information and policy drafts

Latest clarification (20 October 2026): free standard UK delivery applies at **GBP 80 or more**, including exactly GBP 80. This supersedes the earlier strict-over wording. A checkout review preview is implemented; payments/order placement remain unavailable. See [CHECKOUT_SETUP.md](CHECKOUT_SETUP.md).

## Confirmed from the client's message

- Brand: SEEN ABAYAS. Slogan: “Made to Be Seen.”
- The full Our Story wording and Returns & Exchanges policy are supplied in `MASTER_PLAN.md` and were supplied again by the developer on 19 October 2026. Preserve those paragraphs.
- Contact form: name, email, phone and message, delivered to `info@seenabayas.co.uk`.
- Intended delivery partner: Royal Mail.
- Complimentary standard UK delivery on eligible merchandise subtotals **£80 or more**. Exactly £80 qualifies (latest clarification).
- Requested future payment options: pay now, Apple Pay, Klarna and Clearpay. The developer's latest client update prioritizes Apple Pay and Klarna for checkout. Clearpay was requested earlier and is not yet active. No payment method is currently enabled, and provider/customer eligibility still applies. Client payout bank details belong in the payment provider's private onboarding, not repository files or public pages; the supplied bank address does not confirm a legal trading or returns address.
- Intended public domain: `www.seenabayas.co.uk`, purchased through Namecheap. This does not configure DNS, hosting or email. Keep the development site URL while working locally; set the final HTTPS origin when preparing deployment.
- Eight intended designs. Seven photograph groups currently exist; do not manufacture the eighth product or image.

## What is built

`/shipping-delivery`, `/returns-exchanges`, `/privacy-policy`, `/terms-conditions` and `/cookie-policy` use the shared editorial policy layout, responsive section navigation, finite reveals, reduced motion and print styling. The footer includes Explore, Customer Care and Legal groups. Mobile help navigation and the delivery announcement link to the new pages. Contact has a privacy link; product delivery disclosures link to Shipping.

Returns preserves the official policy, with cancellation help added separately. `/returns-exchanges/cancellation-form` downloads an optional plain-text model form. A clear cancellation statement by email is also accepted; using the form or requesting an exchange first is not presented as compulsory. The form has explicit draft seller details until the actual legal name and address are supplied.

The cookie page explains the bag's actual local storage and provides **Clear saved bag**. It removes only the two SEEN bag entries, clears the current bag/counter and lets other idle tabs update through the existing storage event handling. It preserves unrelated browser storage. If storage access is blocked, feedback distinguishes an emptied in-memory bag from a successful removal of persistent storage.

No analytics, advertising tracker, optional-cookie banner, order creation, payment activation or live Royal Mail API integration was added. A cookie consent interface becomes necessary if a future configuration uses technologies requiring consent; assess any applicable exceptions and objection requirements before adding them.

## Settings and missing facts

The public policy settings are in [src/data/store-settings.json](../src/data/store-settings.json), validated by [src/lib/policies.ts](../src/lib/policies.ts). `null` means unknown; a confirmed zero delivery charge or `false` availability is different from unknown.

The client message does **not** provide:

- Legal trading name, legal form and business postal address.
- Return postal address.
- Registration number where applicable, VAT registration status and VAT number if registered. Do not assume SEEN is a limited company or VAT registered.
- Dispatch processing window, standard delivery charge and delivery aim.
- Whether express delivery will be offered, and its actual charge and delivery aim if offered.
- Eligible destinations and restrictions, including Northern Ireland and other UK destination arrangements; international availability.
- Enquiry/security legal bases, enquiry retention, actual hosting/logging arrangements, support mailbox provider, processing regions and applicable international-transfer arrangements.
- Final sale terms, order acceptance rules and tax treatment for the actual business and checkout.

The forms, policies and hosting configuration must be reviewed together before launch. Do not invent these details from the brand name or domain. The site settings file is currently developer-managed; the later authenticated admin settings screen should manage these fields through protected storage. There is no public settings-write endpoint and no hosted Supabase write in this phase.

All five pages show a visible draft notice and set `noindex, nofollow` until required settings are present **and** an explicit review status/date is recorded. Setting the review flag alone cannot hide the notice while required fields remain missing. This validation checks data presence; it is not a legal-compliance certificate. Do not set approval until the actual content, business practices, live integrations and disclosures have been reviewed and updated. Finalise the hardcoded preview/order/payment paragraphs when checkout is built.

Policies describe the current code, not hypothetical future services. Bag entries have no automatic expiry and remain until cleared or removed by the browser. Contact data is not stored in Supabase. When contact is configured, Resend and Turnstile process the relevant information; real service settings, hosting and privacy disclosures must be confirmed. See [CONTACT_SETUP.md](CONTACT_SETUP.md).

## References checked on 19 October 2026

- [GOV.UK: online selling disclosures](https://www.gov.uk/online-and-distance-selling-for-businesses/online-selling).
- [GOV.UK: returns and refunds](https://www.gov.uk/accepting-returns-and-giving-refunds).
- [Consumer Contracts Regulations, Schedule 3](https://www.legislation.gov.uk/uksi/2013/3134/schedule/3/made): model cancellation form; the linked regulations must be checked for current applicability before launch.
- [ICO: privacy information to provide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/). The ICO notes that this guidance is under review following the Data (Use and Access) Act.
- [ICO: storage and access technologies](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/) and [exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/).
- [Royal Mail Tracked 48](https://www.royalmail.com/sending/uk/tracked-48), [Tracked 24](https://www.royalmail.com/sending/uk/tracked-24) and [tracking](https://www.royalmail.com/track-your-item). Carrier service aims are not store dispatch promises or guaranteed delivery dates.
- [Cloudflare Turnstile privacy](https://www.cloudflare.com/turnstile-privacy-policy/) and [pre-clearance configuration](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/pre-clearance/).

Before launch, verify the actual browser/provider storage, confirm the final retention policy and complete the appropriate legal review. No policy was published or treated as final by this local implementation.
