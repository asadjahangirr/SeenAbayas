# SEEN ABAYAS - Project handover and continuation guide

Last reviewed: **21 October 2026**. Workspace: `E:\AsadJahangirr_2pacistan\SeenAbayas`.

This file transfers the project context to a new developer or coding agent. It records the current implementation, the developer's decisions, known limitations, verification history, required client inputs and the remaining execution order. It contains no credentials, passwords, customer records or client bank details.

## 1. Read this first

**Email activation checkpoint (21 October):** operator reports mail.seenabayas.co.uk Verified in Resend and private settings saved locally/Vercel. A presence/format-only local check confirms ORDER_EMAILS_ENABLED=true, expected sender and Resend key format; local payment mode remains test and controlled sandbox inbox is unset. Read-only hosted order_email_status reports ready=true, so do not ask to rerun the email migration. The public www /api/admin/order-emails still returns 404: push/deploy the current email code next, then have the owner/MFA check its configured/issues/database response. No real email, charge, order or stock change was made. Provider key acceptance and actual inbox receipt are not yet verified; domain verification is operator-reported.

**Latest selected phase — automatic paid-order emails (21 October):** user prioritised customer/owner order notifications over coupons. Implemented private durable outbox, verified-paid transition trigger, separate customer confirmation and owner notification to info@seenabayas.co.uk, escaped HTML/plain-text purchased snapshots, lease/idempotent retries and per-order owner/MFA status UI. Existing signed every-minute recovery also drains email; immediate webhook/authorised status callbacks schedule a post-response attempt. Install new 20261021000200_order_emails.sql, configure Resend and deploy using [ORDER_EMAIL_SETUP.md](ORDER_EMAIL_SETUP.md). No hosted SQL, real emails, production env/settings, payments or stock were changed. Domain verification/provider acceptance and actual inbox receipt remain pending; do not call emails active. Existing already-paid orders are not automatically backfilled. The user has Namecheap DNS access, no client mailbox password; a verified sending subdomain mail.seenabayas.co.uk with Reply-To info@seenabayas.co.uk solves this without mailbox login. Preserve existing MX/website records. Local sandbox workers cannot claim live notifications; sandbox sends are suppressed unless an explicit controlled test inbox is configured. After an ambiguous 23-hour retry window, inspect provider logs rather than blindly resending. Dispatch/refund/low-stock emails, coupons and Royal Mail rates remain separate work.

Email-phase validation: production build passed; 30 focused database/model/template checks passed; seven distinct isolated live/payment/admin/email-layout browser checks passed across the full run and corrected focused rerun. Tests send no real messages and use disposable local PGlite/dummy Stripe. A fixture reused a session ID and another test used the tabular catalogue endpoint as an array; both harness errors were corrected. Browser trace saving initially hit ENOSPC on the workspace drive; only the verified generated .next/cache/turbopack build cache was removed, freeing about 312 MB. Source assets were untouched. Email sending activation and true mailbox delivery still require the operator steps.

**Latest sandbox acceptance (21 October):** localhost is test mode again; the actual selected/file key remains standard sk_test_, with no rk_test_ in any parsed setting. Do not certify restricted LIVE write scopes from this. Hosted availability supports only one GBP45 Burgundy size58 piece, with lower-value delivery unknown. No stock or rates were changed; tests used a disposable local PGlite catalogue (GBP75 sample price, five units) with the real Stripe SANDBOX key.

Actual sandbox creation/cancellation passed: local reservation2 released to0, on_hand still5, provider/order expired. A subsequent public-test-card browser attempt reached Stripe complete/paid/livemodefalse, with no real funds or hosted order/stock change. The runner timed out later and did not run decline; its exact heading assertion omitted the actual final period in Test payment complete. That ignored-runner defect is corrected but not rerun after interruption; do not infer full confirmation/signed-event/decline acceptance from the paid status. Card/Klarna/Clearpay were visible in sandbox; BNPL completion, physical Apple Pay, live webhook delivery and restricted-key matching remain pending. Isolated listeners3106/3107 were confirmed closed and DB discarded; sandbox records retained. Production configuration/read-access results below remain passed. No production code/env change was made.

**LATEST: live configuration resolved and independently verified (21 October).** User reports modes live/database ready/issues empty. Public review now independently confirms mode=live/paymentAvailable=true/taxStatus=none/GBP 90/free standard delivery/Secure HttpOnly cookie, and checkout shows Secure checkout. Unsigned webhook 400; unauthenticated recovery/owner diagnostics 401. All earlier current-blocker/preview statements below are superseded by this result. No agent-created order, customer, Checkout Session, reservation or charge.

**Latest owner-reported LIVE provider result (21 October):** the deployed read probe reports environment live, requiredReadAccess/checkoutSessionsRead/customersRead passed, account status passed, chargesEnabled=true and payoutsEnabled=true. Modes remain live, database ready and issues empty. This completes the requested read-only checks; no real customer, Checkout Session, order, inventory reservation or charge was created. No further deployment/env/SQL change is needed for those passed checks. Actual write permissions, live webhook delivery and payment-method eligibility remain explicitly not_tested. The user forbids a real order/charge for verification; do not initiate one. A matching restricted-key sandbox flow is a possible next verification phase, using a separate test environment instead of changing Production for all visitors.

The live key remains only in Vercel; local credentials are test/disabled. The deployed owner+MFA probe at `/api/admin/payments/readiness?stripe=read` uses future-filtered limit-one session/customer GETs and a current-account GET, returning sanitised statuses/booleans only. Plain readiness is configuration-only. check:payments uses the same probe rather than Balance. Build, eleven focused checks and five isolated live UI/API tests passed before the operator result; no runtime change or test rerun was needed to record it. See DOMAIN_PAYMENT_SETUP.md.

**Current root blocker (owner diagnostic, 21 October):** the user supplied requestedMode=live/configuredMode=null/readyMode=null/database=not_checked, with exactly two issues: STRIPE_TEST_SECRET_KEY and STRIPE_TEST_WEBHOOK_SECRET fail format validation. No actual values were disclosed, so absent versus malformed is unknown. Next: privately correct those two retained sandbox values in Vercel Production and redeploy, preserving live primary credentials/mode and other settings. No further code or SQL change is required for this identified configuration error. Verify the diagnostic then the public live review; actual live restricted-key request acceptance remains untested. This supersedes the earlier unknown-cause state.

**Latest continuation (21 October):** another corrected-variable/Ready reply still produced an independently observed public review of preview/payment unavailable/unconfirmed tax for GBP 90 with free delivery. Root cause is still unknown; user did not name the changed setting. Added a locally tested owner+MFA-only `/api/admin/payments/readiness` GET and **Check payment setup** link in Admin Overview. Deploy current application changes, have the owner open the diagnostic and supply only sanitised modes/database/issues, then correct the reported cause. No new SQL is needed. It reads configuration and payment_health only, never Stripe or commerce writes; actual values and customer data are not returned. Anonymous 401/MFA or editor 403/private-no-store. Production build, seven focused settings/diagnostic checks and five live UI/API checks passed. The new route is not yet known deployed; live payments must not be described as enabled. Supersedes repeating the same manual five-setting checklist without further evidence.

**Latest live activation is blocked (21 October):** user reports PAYMENTS_MODE=live/Ready, but independent public review still returns mode=preview/paymentAvailable=false/taxStatus=unconfirmed for GBP 90 with free shipping. No secure/test checkout wording or ownership cookie; unsigned webhook 400/recovery 401/canonical correct. The locally configured hosted Supabase health still reports live/order/stock capability ready and tax_mode=none. Actual Vercel environment mismatch remains undetermined; do not call live checkout enabled, assume the exact cause, blame restricted API permissions from a review that does not call Stripe, rerun migrations or alter inventory. Next is private verification of Production mode/tax/API prefixes/retained test pair/distinct webhook secrets. No order/reservation/payment was initiated. This supersedes the planned successful-live-cutover expectation below.

**Latest credential staging (21 October):** the developer confirms the live primary pair and retained sandbox pair are saved in Vercel and a PAYMENTS_MODE=test deployment is Ready. Subsequent public checks confirm checkout 200/test wording/private-no-store, review mode=test/paymentAvailable=true/GBP 90 with free delivery and Secure/HttpOnly cookie, unsigned webhook POST 400 and unauthenticated recovery 401. Secret values/provider API permissions were not independently inspected. No order/stock/payment mutation occurred. Next manual operation is the final PAYMENTS_MODE=live switch and Ready redeployment, followed by read-only deployed live-mode verification; no genuine purchase is requested at that step. Actual live method/merchant eligibility and restricted-key API acceptance remain unverified.

**Restricted-key operator confirmation (21 October):** the developer now explicitly confirms Checkout Sessions: Write and Customers: Write on the live restricted key. These match the direct SDK calls. Vercel credential staging is next, retaining PAYMENTS_MODE=test and copying the current sandbox pair into STRIPE_TEST_* before replacing the primary pair with live credentials. Actual restricted-key API acceptance and other template scopes remain unverified; do not infer them from an unrestricted sandbox success. No new live checkout/payment was initiated.

**Restricted live key review (21 October):** the developer has created an `rk_live_` key using Stripe's One-time payments template and has not yet updated Vercel. Source accepts restricted keys; no unrestricted key is required. Direct production resources are Checkout Sessions Write and Customers Write; inline resource permission dependencies still need equivalent sandbox-key/request validation. The actual template permissions remain unknown. Refund API processing is still unimplemented. With a live primary key, new test checkout uses both STRIPE_TEST_* values; webhook/recovery follows event/order environment. Four focused configuration tests passed, including added restricted-key environment-isolation coverage. Do not infer live charges enabled from the reported payouts-enabled status. See the restricted-key subsection of DOMAIN_PAYMENT_SETUP.md before cutover.

**Latest operator acceptance (21 October):** the developer confirms a fresh sandbox purchase on www returned Test payment complete and Admin shows Paid/Confirmed. They also report scheduled recovery HTTP 200, no timeout and retryRequired=0 after the domain change. These supersede the pending new-domain card/recovery acceptance notes below. Individual provider event delivery, unchanged physical stock, actual Klarna completion and physical Apple Pay were not independently rechecked from this reply. Next: confirm live merchant/method activation, stage separate live and retained sandbox credentials with PAYMENTS_MODE=test, then enable live mode after verification. No additional SQL or stock reset is required for this step.

**Current hosted checkpoint (21 October, after domain deployment):** the developer confirms the live-capability SQL, URL updates and Ready deployment. Independent read-only checks verify `live_payments_ready=true`, order/stock readiness, the www canonical, apex redirect, and one enabled sandbox webhook at the www path with all four events. New-domain checkout review returns **test mode**, payment available and GBP 90/free standard delivery for two GBP 45 Burgundy pieces in size 58. The catalogue has nine published products. No order, reservation or charge was created by these checks. Fresh new-domain sandbox purchase/admin verification and post-domain scheduled recovery results remain pending; real checkout is not yet enabled. This checkpoint supersedes stale-canonical, migration-pending and test-only-code statements below. See [DOMAIN_PAYMENT_SETUP.md](DOMAIN_PAYMENT_SETUP.md).

**Latest selected work (21 October): real payments and final-domain migration.** The developer explicitly requests real customer payments with testing retained, and says to add zero tax. Implemented locally: disabled/test/live mode, separate retained sandbox credentials, environment-bound Stripe verification/recovery, new 20261021000100_live_payments.sql capability migration, physical stock commits for verified live orders, zero-added-tax display, customer-facing confirmation and once-only clearing of an unchanged purchased bag. No VAT registration/exemption was inferred. Hosted migration/deployment/live credentials and provider acceptance are not yet verified; no real charge or hosted stock edit was performed. See [DOMAIN_PAYMENT_SETUP.md](DOMAIN_PAYMENT_SETUP.md) for the complete operator sequence.

New primary domain: **https://www.seenabayas.co.uk**. Public read-only checks confirm www 200, apex 308 to www; the homepage canonical still uses the old Vercel origin, which now returns 404. Change Vercel NEXT_PUBLIC_SITE_URL, Stripe sandbox/live webhook destinations, Vault seen_stock_recovery_url, Supabase Auth Site URL/exact admin callbacks and configured Turnstile hostnames. Do not alter the Supabase project URL or rotate unrelated keys. Existing sessions retain their frozen return origin and host-scoped cookies do not migrate. Earlier test-only implementation statements below describe the deployed/previous checkpoint, not the newly prepared source capability. Coupon redemption remains pending; the developer changed scope to payment/domain activation first.

**Latest verified stock-recovery checkpoint (21 October):** the developer supplied setup and verification screenshots: seen-stock-recovery runs every minute, active=true, request_table_ready=true; two consecutive requests returned HTTP 200, timed_out=false and {checked:0,updated:0,retryRequired:0}. The corrected Vault URL/setup is now working through signed scheduled HTTP requests. These runs contained no eligible orders, so an actual hosted release/commit is not established by them. Fresh post-migration paid-order/expiry acceptance remains pending; live charging remains disabled. Do not repeat setup based on obsolete failure notes. Use supabase/check-stock-recovery.sql for observation. The next listed development task is checkout coupon redemption (point 5); the latest message confirms recovery rather than explicitly starting that integration. See [STOCK_SETUP.md](STOCK_SETUP.md).

**The storefront, bag, protected admin, UK checkout and private order-status page are implemented. Stripe-hosted Checkout, private test orders, stock reservations and signed payment updates are implemented for TEST MODE ONLY. Real-money charging and commercial launch remain disabled.**

Latest phase — point 4, automatic stock management (20 October): new `20261020000300_stock_management.sql` centralises terminal reservation movements with consistent parent-product locking, guards against duplicate/invalid deductions, records private per-size stock events and leases rotating recovery batches. Admin order details now explain stock status. Scheduled recovery accepts bounded timestamped HMAC proofs, handles overdue open Stripe sessions via verified provider expiry, returns retryable failure counters, and retains pending/indeterminate reservations. `supabase/setup-stock-recovery.sql` prepares a named every-minute Supabase Cron job with its long-lived token kept in Vault rather than queued HTTP headers. See [STOCK_SETUP.md](STOCK_SETUP.md) for installation and verification. The developer confirms applying the stock migration and a Ready deployment; independent read-only health verifies stock_management_ready=true, order_records_ready=true and test_only=true. Checkout returns 200, unauthenticated recovery/admin return 401/private-no-store. An intervening Vault URL error caused setup rollback; after correction, developer screenshots now establish the job/table and two successful scheduled HTTP responses with zero retries/eligible work. Fresh paid-order and expiry acceptance remain pending. The agent has not configured secrets, activated the recurring job or changed hosted stock. Sandbox success still leaves physical on-hand quantities unchanged; real charging/live checkout remain blocked. The prepared internal physical-deduction path is tested only in an isolated rolled-back fixture.

Latest development phase — point 3, order records: purchase snapshots/totals and confirmed customer details now have database update guards; successful verification records confirmation times once and projects canonical private checkout data into a readable admin order view. Duplicate events do not create a second order or invalidate unchanged admin forms; retries can repair a missing projection. Admin now has separate payment/environment filters and item-level CSV export. The developer confirms applying `20261020000200_order_records.sql` and a Ready deployment. Independent hosted health now reports `order_records_ready=true`; both earlier paid test orders retain their saved items/contact/address and matching totals. Their new timestamp columns are present but historical dates remain null by design. A fresh post-migration sandbox purchase/admin-view check remains pending. See [ORDER_SETUP.md](ORDER_SETUP.md). Genuine customer charges are still gated by the separate live-launch work.

Latest catalogue checkpoint (20 October): the developer deployed and applied `supabase/catalog-release-20261020.sql`. Independent hosted checks now verify all nine published designs, matching client names/prices/descriptions, 22 reachable photographs and nine working product pages. Burgundy Roselle availability matches 54 × 1, 56 × 1, 58 × 2 through read-only quantity-boundary checks; the other eight designs are visible and sold out. The shared size guide uses the supplied 54/56/58 length/height chart. Do not rerun or rename the import batch to reset later stock edits. See [CATALOG_UPDATE.md](CATALOG_UPDATE.md) and the latest section below. Old sample prices and sizes are superseded for the commercial catalogue.

The developer has a Vercel preview deployment and has used the hosted Supabase/admin setup. Do not describe the project as having no deployment. A deployed preview is not a completed commercial launch.

The latest delivery rule is **GBP 80 or more qualifies**, superseding every earlier strict-over statement. VAT and below-threshold rates remain unconfirmed. The checkout falls back to review-only behaviour when payments are disabled or setup is incomplete. See [STRIPE_SETUP.md](STRIPE_SETUP.md) for current activation steps and limits.

Latest checkout acceptance blocker: the developer encountered disabled payment on the deployed GBP 45 one-piece order. Read-only deployed reviews confirm a missing below-threshold delivery rate blocks that total; GBP 90 for two pieces remains test-payment eligible. UI wording now distinguishes "Delivery rate unavailable" from general payment unavailability, pending deployment. The developer requests queuing Royal Mail account integration to determine delivery pricing, rather than supplying a flat rate now. Verify actual account/API capabilities in that phase; automatic price quotations are not established. Keep below-threshold payments blocked until a valid rate source is configured, and preserve free standard delivery at GBP 80 or more. The fresh point-3 sandbox/admin verification remains pending.

Latest payment checkpoint (20 October): the developer pushed `aff54b1`, saved Vercel settings, enabled `PAYMENTS_MODE=test` and redeployed. Public checkout/review and a signed read-only webhook diagnostic now pass, including protected database access and secure checkout-cookie attributes. Stripe independently reports Cards, Apple Pay, Klarna and Afterpay/Clearpay available/display on in the default sandbox configuration. The Dashboard snapshot endpoint is **https://seenabayas.vercel.app/api/payments/stripe/webhook**; CLI access is not required. Card and Clearpay sandbox success have both been independently verified: matching Stripe/private paid test orders, released reservations, and real completion events with zero outstanding webhook deliveries. Klarna completion and a physical Apple Pay test remain pending. The developer has been given the official UK Klarna test fixtures for the next checkout. Real charges are still rejected. See section 20 for evidence and limits.

The previous completed UI change is the phone/tablet homepage: the navigation row is completely hidden over the opening film and appears as the SEEN logo docks into the navbar on scroll. Playback requests muted autoplay, with no Play/Pause button. See section 5 before changing this.

### Evidence and precedence

1. The developer's latest explicit requests take precedence over earlier plans and historical documentation.
2. Current code and migrations establish what is implemented.
3. This handover consolidates the current checkpoint and the conversation's accepted decisions.
4. [MASTER_PLAN.md](MASTER_PLAN.md) contains the original detailed brief; several choices have since been superseded.
5. [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md) is a chronological log. Earlier sections describe old states, not the present implementation.

Some README/setup prose still says the admin is future work, the photo hero is primary, the film needs a flag, Play recovery exists, migrations are all pending, or no deployment exists. Those statements are historical. Prefer the latest sections and this handover, then verify the code and live environment.

Implementation, local tests, read-only hosted checks and user-reported setup are separate evidence. Do not turn an old observation into a claim about the current database. No full test suite or hosted connectivity test was rerun solely to write this document.

## 2. Client, brand and commercial brief

- Brand: **SEEN ABAYAS**, a UK modest-fashion/abaya store.
- Main slogan: **Made to Be Seen.**
- Additional supplied wording: "More than modestwear. A statement of elegance." and "Elegance that speaks for itself."
- Story: founded by sisters with a shared passion for modest fashion; timeless elegance, individuality, confidence and contemporary modestwear. Preserve the official supplied story paragraphs in the existing Our Story page and master brief.
- Currency: **GBP**, displayed with the pound symbol. Store monetary amounts as integer pence; admin inputs accept pounds.
- Current photographed range: **nine abaya designs**, with Brown and Olive added to the original seven on 20 October. All nine prices are now client-confirmed, including Polka Dot at GBP 45.
- Customer care: **info@seenabayas.co.uk**. The owner can change the configured address through Website text.
- Domain: **www.seenabayas.co.uk**, purchased through Namecheap. Domain ownership does not prove DNS, email or production hosting is configured.
- Intended courier: **Royal Mail**.
- Delivery offer: complimentary standard UK delivery on eligible merchandise subtotals **GBP 80 or more**. Exactly GBP 80 qualifies (latest developer clarification, 20 October). The amount/offer are admin-configurable.
- Requested payments: **Apple Pay, Klarna, pay-now/card payments and Afterpay/Clearpay**. The latest payment-setup request asks for all previously mentioned methods, including Clearpay.
- Klarna is a payment-provider buy-now-pay-later option, not cash on delivery. Do not promise a particular payment plan or availability before merchant activation and eligibility are verified.
- The client supplied payout bank details privately in chat. Do not reproduce them in code, documentation or public pages. They belong in the client's payment-provider onboarding. The bank address is not a confirmed trading/returns address.

The client has not supplied enough information to finalise business/legal disclosures, shipping prices/times, tax treatment or the commercial product catalogue. Do not invent those facts.

### Supplied returns-policy requirements

The existing Returns & Exchanges page preserves the client's supplied text. It includes exchanges within 14 days subject to availability; unworn/unwashed condition apart from reasonable inspection; tags and proof of purchase; customer-paid change-of-mind postage; eligible online cancellation notification within 14 days followed by a further 14 days to return; original-method refunds including standard outbound delivery where required; faulty/incorrect-item remedies; tracked-return advice; and statutory-rights wording. Read the actual existing page before editing it. Do not replace it with an exchange-only/no-refund policy.

## 3. Stack and architecture choices

Versions below are from `package.json` at this handover, not recommendations to upgrade automatically.

- **Next.js 16.4.2**, App Router, route handlers and server-rendered pages.
- **React / React DOM 19.3.1**.
- **TypeScript 5.9.3**.
- **Tailwind CSS 4.3.3**, with substantial shared and route/component CSS.
- **Supabase** PostgreSQL, Auth and private Storage; `@supabase/supabase-js` 2.118.0 and `@supabase/ssr` 0.12.7.
- **GSAP 3.15.0**, including the film's scroll timeline and configurable storefront motion.
- **Zod 4.6.7** for runtime validation.
- **Lucide React 1.59.0** for icons.
- Locally hosted **Inter** and **Cormorant Garamond** fonts, loaded using `next/font/local` and installed font packages.
- **Playwright 1.64.1**, **axe-core/playwright 4.14.0**, and **PGlite 0.5.10** for browser/accessibility and isolated PostgreSQL tests.
- **Sharp 0.35.5** for image preparation.
- **Node.js 24.x**, pinned in package and lockfile. Windows development uses PowerShell; `npm.cmd` avoids PowerShell script-policy issues.
- **Vercel** is the current deployment platform, as evidenced by the developer's deployment screenshot.
- Contact integration is implemented against **Resend** and **Cloudflare Turnstile**; these require configuration.
- **Stripe 23.0.0** server SDK and hosted Checkout are installed/integrated for sandbox payments. The SDK API version is `2026-09-30.endive`. There is no browser Stripe.js/embedded form. Live keys/mode are rejected.

Supabase is the backend; server code lives in Next.js route handlers/server modules and protected SQL functions. There is no separate Express service. Prisma, Auth.js and Cloudinary were alternatives in the original plan and are not the adopted architecture. Do not introduce another auth/database stack unnecessarily.

## 4. Current checkpoint and routes

### Public storefront

- `/` - permanent video homepage, curated product edit and story preview.
- `/collection` - complete published catalogue with search, colour/category filtering and alphabetical sorting.
- `/collection/[id]` - shared product template, currently using references such as `design-01`; admin-created products use the same template.
- `/bag` - functional shopping bag, now linking to checkout.
- `/checkout` - responsive contact/delivery, server-reviewed summary and conditional test payment redirect.
- `/order-confirmation` - browser-authorised private test-order/payment status, pending/failure/retry/cancellation states.
- `/our-story` - official supplied brand story.
- `/contact` - form UI, validation, protected email adapter and fallback customer-care details.
- `/size-guide` - measurement guidance and the supplied 54/56/58 length and suggested-height chart.
- `/faqs` - current browsing/bag/preview information.
- `/shipping-delivery` - delivery information and unconfirmed business/service settings.
- `/returns-exchanges` - supplied policy plus cancellation help.
- `/returns-exchanges/cancellation-form` - downloadable text form, not another HTML page.
- `/privacy-policy`, `/terms-conditions`, `/cookie-policy` - implemented policy drafts.

All fifteen core page types now have UI, including checkout and private test-order confirmation. With seven designs there are twenty-one customer HTML URLs; eight designs would give twenty-two. These counts do not establish hosted publication or real purchase readiness. Commercial payment/order activation, refunds, emails and launch work remain.

Desktop navigation deliberately has four primary links: Home, Collection, Our Story and Contact Us. Help/legal pages are accessible from footer/mobile navigation. Four navbar links does not mean only four pages exist.

### Admin and APIs

- `/admin/[[...section]]` - fourteen admin sections, detailed below.
- `/admin/login`, `/admin/recover`, `/admin/auth/callback`.
- `/admin/preview/[[...path]]` - authenticated draft preview; also supports the draft cancellation download.
- `/api/admin`, `/api/admin/auth`, `/api/admin/media`.
- `/api/bag`, `/api/contact`, `/api/media/[name]`, `/api/storefront/sync`, `/api/checkout/review`.

Payment APIs now include `/api/checkout/session`, `/api/checkout/status`, `/api/checkout/cancel`, `/api/payments/stripe/webhook`, owner-only `/api/admin/payments/reconcile` and protected server-to-server `/api/payments/reconcile`. Customer accounts, wishlist and newsletter remain absent. Generic error/not-found handling exists.

## 5. Approved design decisions - preserve these

The developer wants a clean luxury fashion presentation inspired by the quality and restraint of Gucci/Louis Vuitton, with refined hover/scroll animation and responsiveness from the beginning. Use the supplied SEEN identity and actual garments. Do not fabricate client assets or copy another brand's identity.

### Permanent film homepage

- The film version is the primary and only homepage hero. The previous photograph/lookbook hero and comparison switch were removed with permission.
- No `?hero=film` flag or photo variant is needed. Old comparison query parameters do not change the hero.
- The supplied `add.mp4` fills the hero. Left-aligned "Made to Be Seen" text and the collection CTA avoid overlapping the large logo; preserve the intentional line break before "Be Seen" where applicable.
- The supplied Arabic emblem plus **SEEN** artwork is used without the small bottom tagline. Do not replace it with a typed wordmark or reintroduce the lower line.
- The large logo starts over the film and smoothly moves/scales into the navbar as the user scrolls; scrolling back reverses it.
- Desktop: the navbar initially overlays the film transparently with light controls, then becomes white with dark controls when the logo docks.
- Below **1024 px**: the entire navigation row starts hidden, including menu/care/bag controls, then appears during the final docking segment. It hides again when returning to the top. The shipping announcement stays visible.
- Hidden controls use CSS visibility so they cannot receive focus while their layout still permits docking measurements.
- Reduced motion or animation-load failure keeps usable visible navigation; reduced motion shows the still poster and docked logo.
- The film requests muted, inline, looping autoplay. There is **no Play/Pause button and no native control bar**, per explicit developer request.
- A natural film tap can retry browser-blocked playback. Offscreen/hidden-tab pausing and page-restoration/reconnection handling remain.
- The application's data-saving flag no longer suppresses autoplay. Reduced-motion preference and browser/load restrictions can still result in a poster. A site cannot guarantee autoplay against browser policy.
- The supplied film is **1280 x 720**, approximately **10 seconds / 3.5 MB**. It is not a genuine 1080p source. Its bytes were preserved; obtain a higher-resolution original if true Full HD is required.

### Other storefront decisions

- Home introduces the brand and offers a curated edit of up to four pieces. Collection is the complete catalogue with a compact heading, not another large hero.
- The old "View more pieces" expand/collapse control is removed. One link to the full collection remains.
- Product cards navigate directly to their product page. No quick-view/lightbox popup or "A closer look" route is wanted.
- No "Another view" badge/button over hero images; the old photo hero itself is retired.
- Product photography uses subtle pointer-following magnification on desktop hover. No plus/minus zoom controls.
- Touch alternatives: tap to magnify, drag to inspect, tap to return, swipe normal views. Keyboard alternatives remain available.
- Search matches partial word beginnings across names, colours/aliases and relevant descriptions. `r` can match red/Burgundy; Burgundy aliases include red/maroon/wine, charcoal includes grey/gray. Do not require full-word entry.
- Collection sorting is **A-Z / Z-A only**. Do not restore "The SEEN edit" sorting or other sorts without a new request.
- The delivery banner is animated without a pause button; hover/focus holds it for reading and reduced motion gives a static message.
- The current hero/banner motion choices must not be described as complete WCAG conformance merely because automated checks pass.

## 6. Catalogue, sample data and bag behaviour

### Original temporary product choices

These names/prices were chosen by the agent at the developer's explicit request. They are development choices pending client approval, not verified market valuations or commercial specifications:

- `design-01`: Layla Burgundy Abaya - **GBP 75**.
- `design-02`: Zahra Botanical Abaya - **GBP 85**.
- `design-03`: Noor Lace Abaya - **GBP 85**.
- `design-04`: Haya Charcoal Abaya - **GBP 69**.
- `design-05`: Rima Textured Abaya - **GBP 75**.
- `design-06`: Luma Polka Dot Abaya - **GBP 69**.
- `design-07`: Amal Neutral Abaya - **GBP 75**.

See `src/data/development-catalog.json` and `supabase/catalog-drafts.sql`. Hosted admin edits take precedence over these defaults; do not overwrite them by reimporting assumptions.

The developer explicitly authorised temporary length labels **52, 54, 56, 58, 60 inches** and **five sample units per length** to test the bag before real data arrives. These are common retail-style length options, not confirmed SEEN garment/body measurements or fit recommendations. Do not invent fabric/care claims. The development catalogue has thirty-five temporary variants across the seven original designs.

### Source modes

- `CATALOG_SOURCE=preview`: original photography presentation; purchasing disabled because commerce details are unconfirmed.
- `CATALOG_SOURCE=development`: explicit local sample catalogue with temporary stock/sizes. No hosted inventory writes. Uses separate bag storage from live mode and cannot enable indexing.
- `CATALOG_SOURCE=supabase`: reads only published database merchandise and real database availability. Empty/error states do not fall back to sample products.
- `CMS_SOURCE=files`: checked-in default text/media/settings.
- `CMS_SOURCE=supabase`: published admin content. Required together with catalogue Supabase mode for the intended unified live store.

**Desktop and phone use one shared catalogue and inventory.** Never explain an unavailable phone size as separate mobile stock. Never change hosted stock merely to make a test pass without the applicable authorisation and an explicit understanding of the affected records.

### Bag implementation

- Animated bag icon/count, accessible drawer and responsive full bag page.
- Size selection, Add to Bag, merging the same variant, quantity changes and removal.
- Maximum twenty distinct lines and ten units per line, subject to actual availability.
- Browser storage contains only variant IDs and quantities, not trusted prices or payment details. Live key: `seen.bag.v1`.
- Server revalidates published products, prices, stock and totals; rejects tampering and invalid quantities.
- Saved bags revalidate on reload; stale/unavailable lines show useful feedback and do not inflate the payable subtotal.
- Tabs synchronise bag changes. Blocked local storage does not break the in-memory shopping session.
- Bag actions **do not reserve/decrement inventory, create an order or take payment**.
- Delivery progress uses the published offer; default threshold comparison is inclusive `subtotal >= 8000` pence for a nonempty eligible selection.
- Preview/out-of-stock pieces keep a visible Add to Bag control with truthful disabled/error states. "Ask about sizing or availability" is a secondary customer-care link, not checkout.

## 7. Admin dashboard - already built

The user requested functionality from their previous project, `https://github.com/asadjahangirr/pd`. That repository is a reference, not evidence that it is this project's Git remote. An ignored `.reference/` checkout may remain. Do not copy its secrets, branding or dependencies into this store.

The fourteen current sections are defined in `src/lib/admin/model.ts`:

1. **Overview:** connection state and operational summaries.
2. **Products & stock:** add/edit products, names, GBP prices, private cost, description, colour/tone, category, photos/order/alt text, sizes, SKU, active status, stock and visibility; bulk stock/archive/order operations.
3. **Categories:** create/edit/delete; generated slug; assign products through their editor. Empty categories remain visible in the public filter after the sync migration.
4. **Orders:** search/filter, customer/item details, fulfilment status, tracking, notes and CSV export. Real order creation and payment/refund integration are future work.
5. **Inbox:** read/unread, archive/unarchive, contact details, notes, deletion and email reply link. Verified form-message ingestion is optional and requires service configuration.
6. **Finance:** verified net-payment totals, expense records and cash after recorded expenses. This is not full accounting profit, VAT accounting or bank reconciliation.
7. **Coupons:** percent/fixed-pound codes, minimum subtotal, active/expiry state and usage limit. Customer redemption is not implemented yet.
8. **Hero video:** choose/reorder up to eight MP4 clips, poster and internal CTA destination; wording through Website text. Clips can play sequentially.
9. **Media library:** direct computer uploads, visual search/picker, reuse and configurable image/video sections.
10. **Website text:** search/filter registered copy, edit/reset labels, headings, prose, forms, image descriptions and supported metadata.
11. **Appearance & motion:** ink/paper/accent, featured products, optional hidden homepage edit, GSAP reveal and hover presets. Contrast validation protects configured text/background combinations.
12. **Store settings:** announcement/colours/speed, free-delivery offer/threshold, future checkout minimum, business/returns details, delivery and policy/privacy settings.
13. **History & activity:** restore retained published content into a new draft; audit changes.
14. **Account & security:** password/email change and MFA-aware recovery flows.

### Publishing and visibility

- **Save & update store** publishes website content. **Save draft** deliberately stays private; **Preview draft** permits authenticated review without shopping.
- Products have separate saved visibility. New products default to Visible in store with **Save & show in store**; hidden products stay private.
- A public product needs saved name, description, positive price, photograph, an active size and known inventory. Zero stock is allowed for a published sold-out item.
- Bulk **Show in collection / Hide from collection**, per-row Show/Hide, selected-count feedback, Select all matching/clear, public product View and View collection links are built.
- Bulk visibility supports up to five hundred saved products. The complete selection is validated before publication; one incomplete item prevents partial success.
- Homepage featured selection is separate from the collection. Publishing a new product does not automatically replace the four chosen homepage pieces.
- Stale product/content versions are rejected so one administrator cannot silently overwrite another's newer changes.
- On-hand inventory cannot fall below reserved inventory; inventory/variant changes invalidate stale product forms.
- Owners can permanently delete unused products. Existing order references or reservations block deletion; archive those products instead. Reusable uploaded files are retained.
- Last thirty published content revisions and latest one hundred audit events are retained/exposed by the current tools.
- Operational lists/search/CSV load the latest one thousand combined records. Add pagination before exceeding that volume. Aggregate finance/order counts are calculated independently across all records.

### Roles and account setup

- Supabase Auth plus invite-only database membership; no public admin signup or default credentials.
- Owner/editor roles with mandatory TOTP MFA and `aal2` checks in server/database operations.
- Editors manage presentation/catalogue; sensitive finance/customer/business settings require owner access.
- Initial ownership uses `supabase/bootstrap-admin.sql` after creating the intended Auth user. Change the example email in SQL Editor; do not commit real identities/passwords in the template.
- Admin membership changes and lost-authenticator recovery remain project-owner tasks.
- Recovery/email-confirmation delivery needs Supabase Auth email settings and correct allowed callback URLs, separate from the contact form's Resend integration.
- See [ADMIN_SETUP.md](ADMIN_SETUP.md) for the exact workflows and callback examples.

## 8. Media library and source assets

### Source organisation

- Original supplied material is preserved under `assets/source/` with provenance/manifests.
- Initial intake recorded twenty-five supplied files, fifteen unique garment photos in seven groups, three exact duplicates and six unassigned videos. Later brand/hero additions are recorded separately.
- `assets/manifest.json`, `assets/media-inventory.json` and `assets/source/relocation-inventory.json` record grouping/preparation/provenance.
- `assets/incoming/` is for future intake.
- Prepared public product images live under `public/images/products/design-XX/`.
- `src/data/media.generated.json` and `src/data/collection.ts` provide typed original image mappings.
- Public WebP preparation auto-orients/resizes and strips EXIF/XMP without garment retouching; originals remain separate.

### Canonical hero/logo assets

- `public/videos/home/hero.mp4`.
- `public/images/home/hero-poster.webp`.
- `public/images/brand/seen-signature.svg`.
- `assets/home-hero.json` records the source, dimensions, duration and hash.
- `assets/source/brand/seen-transparent.png` preserves the supplied transparent artwork.
- The signature SVG frames the supplied raster artwork without the tagline; it is not a newly traced vector.
- Required public film/poster/signature files are included with the project, not ignored local experiments.

### Uploaded media

- Private Supabase Storage bucket: `seen-media`.
- JPG, PNG, WebP and MP4; twenty-five MB per file, up to twenty files per batch. SVG uploads are disabled.
- Immutable UUID object names; original filename metadata assists browsing.
- Shared visual picker supports upload without leaving product/hero editing.
- Public delivery through `/api/media/[name]` requires a reference from published content or a published product. Draft/unreferenced material remains private.
- Draft/product/retained-history references prevent accidental media deletion.
- Product photos/logo/poster slots require still images; hero slots require MP4. Do not put video in an image-only slot.
- Up to twenty-four flexible media sections: target a customer page, all product pages or a particular product; place before/after content; choose framing, descriptions/captions/poster; reorder/remove/reuse.
- These extra page-video sections have native controls and do not autoplay. The no-controls autoplay rule is specifically the hero.
- Deleting a placement does not delete the underlying uploaded file. Retarget placements for deleted products.

## 9. Storefront synchronisation

The user previously reported products/categories missing after saving and requested fast understandable editing. This was addressed; do not build a second CMS or bypass publication constraints.

- `src/components/cms/storefront-sync.tsx` checks `/api/storefront/sync` every **two seconds** while visible/online.
- Same-browser change notifications accelerate updates. Other devices independently check the public revision.
- Only a changed revision triggers full page-data refresh. Scroll, collection filters and appropriate client state are preserved.
- Hidden/offline tabs pause; focus/reconnection catches up. Failures back off and retry. Bag quotations refresh after catalogue/content changes.
- It is fast polling plus browser notifications, **not a Supabase Realtime subscription or zero-latency guarantee**.
- The public sync response exposes an opaque revision and public categories, not drafts, private costs, customers or exact stock.
- `20261019000300_storefront_sync.sql` adds the full revision/empty-category path. A compatibility read supports older installations but cannot provide all empty categories.

If a product is missing: check both source modes, saved visibility/required fields, active sizes/known stock, collection filters and category assignment. Check homepage featured selection separately. If the UI names a migration, verify that migration in the hosted project; do not blindly rerun the initial schema.

## 10. Database and migrations

Important structures:

- `public.products`, `public.product_variants` and private `seen_private.inventory`.
- Private `admin_members`, `site_documents`, `admin_records`, `admin_audit`, `site_history`, `storefront_state`.
- `admin_records` retains category, coupon, expense, order and message JSON records. Payment authority now resides separately in private transactional `checkout_orders`, `checkout_items` and `stripe_event_receipts`, mirrored to protected admin order records. This new schema is test-only; generic admin JSON is never payment authority.
- CMS documents have draft/published versions, text/media overrides, sections, hero, appearance, announcement, commerce settings, featured references and policies.
- Exact inventory/private costs and operational information are not public catalogue fields.

Important RPCs include `get_storefront_catalog`, `get_storefront_catalog_v2`, `check_bag_availability`, `get_site_document`, `get_storefront_state`, `admin_access`, `admin_snapshot`, `admin_save_site`, `admin_restore_site`, `admin_save_product`, `admin_bulk_products`, `admin_delete_product`, `admin_save_record`, `admin_delete_record` and `record_verified_enquiry`. Read their actual SQL before extending them.

Migration dependency order:

1. `supabase/migrations/20261018000100_catalog.sql` - original schema, public read contract and access/publication constraints. **Not a rerunnable reset script.**
2. `supabase/seed.sql` - original seven photograph references as drafts. `supabase/catalog-drafts.sql` fills delegated names/prices without replacing existing choices; neither is a production inventory import.
3. `supabase/migrations/20261018000200_bag_availability.sql` - read-only requested-quantity availability checks.
4. `supabase/migrations/20261019000100_admin.sql` - roles, CMS, operational records, product writes and newer public catalogue contract.
5. `supabase/migrations/20261019000200_admin_media.sql` - Storage/public-reference protection.
6. `supabase/migrations/20261019000300_storefront_sync.sql` - revision/empty-category synchronisation; safe to rerun.
7. `supabase/migrations/20261019000400_product_delete.sql` - protected owner-only deletion; safe to rerun and does not itself delete products.
8. `supabase/migrations/20261019000500_product_visibility.sql` - protected bulk visibility; safe to rerun and does not itself change product visibility.
9. `supabase/migrations/20261020000100_payments.sql` - private test orders, transactional reservations, payment events and admin protections. User-applied successfully; protected hosted health verified.
10. `supabase/migrations/20261020000200_order_records.sql` - canonical admin order projection, confirmation timestamps and purchase guards. User-applied; hosted capability verified. A fresh post-migration user payment/admin acceptance check remains pending.
11. `supabase/migrations/20261020000300_stock_management.sql` - central stock settlement, private movement history and leased recovery batches. Developer confirms installation/deployment; independent hosted health reports `stock_management_ready=true` and `test_only=true`. Separately configure `supabase/setup-stock-recovery.sql` after deployment/private Vault setup; this operator activation is not yet confirmed. The developer confirms saving a private recovery token locally/in Vercel and a Ready redeployment; a presence-only local check confirms its valid length. Subsequent corrected setup and HTTP-result screenshots on 21 October now establish an active every-minute job, an existing request table and two HTTP 200/no-timeout/zero-retry runs. Routine observation uses check-stock-recovery.sql; no setup rerun is required.
12. `supabase/migrations/20261021000100_live_payments.sql` - mode-aware service-only order creation/settlement and zero added tax. Prepared/tested locally for the explicit live-payment request; hosted activation is unconfirmed. Keep both credential environments and follow DOMAIN_PAYMENT_SETUP.md.

Hosted status from the conversation:

- The user created/configured Supabase and added the URL/publishable key. Catalogue and bag read-only checks subsequently succeeded.
- The user explicitly confirmed success for the storefront-sync migration `003` and product-delete migration `004`.
- Admin/media code is implemented and the user has been using admin workflows; do not assume every earlier setup step is pending.
- The user was asked to apply bulk-visibility migration `005`, but no explicit completion reply is recorded. Verify rather than assume.
- `relation "products" already exists` from rerunning the initial schema means that table already exists. Inspect installed objects/migrations; do not drop data to suppress the error.
- `Success. No rows returned` is normal for SQL statements with no result set, including migrations/seed statements. Verify the expected objects/records separately.
- No hosted schema/data changes were made while preparing this handover.

## 11. Configuration and current local setup

`.env.local` exists and is ignored/untracked. `.env.example` is intentionally tracked and contains blank integration placeholders, not real secrets.

At handover, a **presence-only local check** found:

- `CATALOG_SOURCE=supabase`.
- `CMS_SOURCE=supabase`.
- `SITE_INDEXING_ENABLED=false`.
- Supabase URL and publishable key configured.
- Site URL configured; value deliberately not copied here.
- Resend key/sender and Turnstile site/secret keys **not configured locally**.
- `CONTACT_INBOX_ENABLED` unset, so optional ingestion is not enabled locally.
- The initial handover lacked a server secret; the latest payment checkpoint has a privately configured server secret whose protected `payment_health` call succeeds.

This is local configuration only. Vercel environment variables and external dashboards were not inspected during handover and may differ. Existence of credentials is not a new successful connectivity test.

Environment names currently supported:

```dotenv
# Safe illustrative configuration. Supply actual values privately.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SITE_INDEXING_ENABLED=false
CATALOG_SOURCE=supabase
CMS_SOURCE=supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
RESEND_API_KEY=
CONTACT_FROM_EMAIL=
CONTACT_TURNSTILE_SITE_KEY=
CONTACT_TURNSTILE_SECRET_KEY=
CONTACT_INBOX_ENABLED=false
SUPABASE_SECRET_KEY=
```

The Supabase catalogue parser expects an `sb_publishable_...` key, not a secret/service-role key. The normal admin/product/media paths use authenticated users, RLS and protected RPCs; a privileged key is not required for them. The optional verified-enquiry inbox writer uses a server-only secret. Never prefix a secret with `NEXT_PUBLIC_`, print `.env.local`, commit it or ask the user to paste credentials into chat.

Use an HTTPS public origin; loopback HTTP is permitted for development. Indexing requires an explicit site URL and must remain off during incomplete/sample operation. Set matching deployed variables and allowed Auth callback URLs; changing local values does not configure Vercel.

Payment configuration is now implemented: `PAYMENTS_MODE=disabled|test`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the existing `SUPABASE_SECRET_KEY`, and optional `PAYMENTS_RECONCILE_SECRET`. See `.env.example` and [STRIPE_SETUP.md](STRIPE_SETUP.md). This older illustrative block omits their values deliberately.

## 12. Contact, inbox and business-policy readiness

### Contact

- Required fields: name, email, phone and message; client/server validation.
- Resend adapter with idempotency; configured owner-controlled recipient, customer Reply-To and no user-controlled sender.
- Turnstile server verification of token, action and hostname; honeypot, bounded requests, origin checks and duplicate submission protection.
- All four Resend/Turnstile settings are required. Without them, sending is disabled/returns unavailable instead of pretending success.
- Confirm the real support inbox exists; verify the sender domain without breaking its existing MX records.
- Optional inbox copying only follows a validated, provider-accepted enquiry. It needs `CONTACT_INBOX_ENABLED=true` and a server-only Supabase secret.
- Local tests inject provider responses; **no live email delivery has been verified by the agent**.
- Current limiter is process-local: three attempts/email/fifteen minutes and thirty/minute/process. Shared hosting/WAF limits are required before launch.
- Setup: [CONTACT_SETUP.md](CONTACT_SETUP.md). Some older text saying contact records are never stored predates the optional inbox feature.

### Policies and unknown business facts

Checked-in `src/data/store-settings.json` deliberately has null/unconfirmed values; published Supabase settings may override it. Do not assume file defaults describe every live admin value.

Finalise/confirm:

- Legal trading name/form, business address, returns address, registration details where applicable, VAT status/number and any public phone.
- Dispatch window, standard rate and service aim, express availability/rate/aim, destinations and international availability.
- Actual privacy lawful bases, enquiry retention, hosting/log handling, processors/transfers and order/payment handling after checkout exists.
- Sale/order acceptance/cancellation terms and tax treatment for the actual business.

Draft notices/noindex remain until required fields are complete **and** an explicit review status/date is recorded. A review flag alone does not approve incomplete disclosures or certify legal compliance. Update current preview/payment paragraphs and FAQs when the implementation changes. See [BUSINESS_SETUP.md](BUSINESS_SETUP.md).

Cookie policy already explains functional bag storage and offers a working Clear saved bag control. No analytics/advertising tools are currently installed. Add consent controls if introducing optional technologies that require consent; do not claim a banner alone establishes compliance.

## 13. Security already implemented and boundaries to preserve

- Strict Zod/body validation, integer-pence money and server-authoritative bag pricing/availability.
- Public read grants/RLS, private inventory/operations, fixed-search-path protected SQL functions and publication checks.
- Server/database admin membership and MFA checks, owner/editor restrictions, secure session-cookie handling and stale-write protection.
- Storage upload/reference protection; no public access to private draft files solely because their name is known.
- Per-document fresh nonce CSP in `src/proxy.ts`, baseline response headers in `next.config.ts`, private/no-store documents and validated origins.
- Allowed browser integrations are narrow. External images/general API connections are not automatically allowed.
- CSV output guards against spreadsheet formula injection.
- `.gitignore` excludes `.env*` except `.env.example`, dependencies, builds, test output, logs and `.reference/`.

Do not cache nonce-bearing HTML with a reused nonce. Any Stripe/other browser integration must deliberately update and test CSP, redirect/form/frame/connect requirements for its chosen implementation. Do not broadly loosen CSP as a workaround.

The current app is not certified fully secure because a build/tests pass. Payment/webhook trust, transactional inventory, shared abuse limits, provider settings, real role/storage tests, backups and monitoring still need launch work. A full historical GitHub secret scan was not performed during this handover; only local ignore/tracking status was checked. If a secret was previously committed, ignoring it later does not undo exposure.

## 14. Verification history and known device issue

Latest checkout phase (20 October): final production build and 95 distinct checks passed across completed runs: 65 database/model, 11 checkout browser, 13 catalogue/bag, five delivery/product/FAQ/banner and one admin delivery-threshold/publication check. Desktop/phone screenshots were reviewed. See [CHECKOUT_SETUP.md](CHECKOUT_SETUP.md). This does not verify physical devices or live payments. Earlier counts below describe prior phases and overlap with later coverage.

Use [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md) for the chronological results. These are prior runs, not a fresh complete-suite certification at handover:

- Storefront sync/admin phase: reported 106 distinct checks across database/model, admin, catalogue/bag and homepage/collection runs.
- Product deletion/reusable uploads: production build, fifty-seven database/model checks and twenty-five distinct admin browser checks passed across completed runs/focused reruns.
- Bulk visibility: production build, twenty-three focused database/model checks and seven focused browser checks passed.
- Android repair phase: production build and thirty-six distinct browser checks passed across eleven mobile, fifteen film, seven bag and three contact checks.
- Latest hidden-phone-navigation/no-Play-button change: production build, all fifteen film checks and four focused Android touch checks passed. Screenshots before/after docking were reviewed.
- These sets overlap and occurred at different revisions. Do not add them together as a current total. Old failed screenshots in ignored `test-results/` are historical, not proof of a current failure.
- Automated device checks use Windows Edge/Chromium with Android/touch emulation. Physical Android Chrome and iPhone Safari testing remains outstanding.
- Mutating automated tests use isolated fixtures/PGlite, not the client's hosted products.

The reported problem device was **Android / Chrome**. Earlier browser-only uses of `AbortSignal.any/timeout` caused compatibility failures; `src/lib/request-deadline.ts` now supplies disposable AbortController deadlines for bag/sync/contact. `src/lib/browser-id.ts` supplies a cryptographic UUID fallback when `crypto.randomUUID` is absent in HTTP/LAN preview contexts. Server Node APIs need not be replaced just because a browser API was fixed.

Last recorded live read-only/device-emulated observation: Supabase catalogue and bag RPCs succeeded; the homepage video played; one published product had **zero available sizes**; no horizontal overflow or JavaScript errors were observed. Live Add to Bag could not complete for that unavailable item. Local fixture shopping passed. The user subsequently clarified unavailable sizes explained Add to Bag. No stock was changed to bypass it. This is a dated observation, not a current stock count; inspect current admin/live data if diagnosing again.

## 15. Commands and tests

Run from the workspace root. Use `npm ci` for reproducible installation from the existing lockfile; use `npm install` when intentionally updating dependencies.

```powershell
npm.cmd ci
npm.cmd run dev
```

Default development URL: `http://localhost:3000`. Build before production-server browser suites.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:catalog
npm.cmd run test:foundation
npm.cmd run test:catalog-ui
npm.cmd run test:development-ui
npm.cmd run test:contact-ui
npm.cmd run test:film-ui
npm.cmd run test:admin-ui
npm.cmd run test:mobile-ui
npm.cmd run test:checkout-ui
```

- `test:catalog`: actual SQL/schema/access/model checks with isolated PGlite, no Docker/hosted service required.
- `test:foundation`: general storefront checks; starts production app on port 3100.
- `test:catalog-ui`: configured catalogue/bag fixture checks, ports 3101/3102.
- `test:development-ui`: sample-catalogue UI checks; see its config for ports.
- `test:contact-ui`: injected email/challenge behaviour; no real sends.
- `test:film-ui`: production app on 3105; explicit development catalogue/files CMS for isolated film checks.
- `test:admin-ui`: isolated fixture on 3106 and production app on 3107.
- `test:mobile-ui`: inherits admin fixture/server setup and Pixel 5 touch emulation. Run sequentially with admin tests because their ports overlap.
- Windows browser configs use installed Edge; base suites support `PLAYWRIGHT_CHANNEL=chrome`. Read each config before assuming all inherit that override. Other systems may require Playwright Chromium installation.
- `check:catalog` / `check:bag`: read-only checks using configured hosted Supabase; require network and valid local setup. Do not print keys or mistake these for full authenticated integration tests.
- No separate lint command is currently defined.

Media/copy utilities:

```powershell
npm.cmd run prepare:media
npm.cmd run prepare:brand
npm.cmd run prepare:copy
npm.cmd run prepare:hero -- 'C:/path/to/approved-campaign.mp4'
```

Only run preparation when deliberately changing its inputs. Review regenerated assets/manifests. New CMS-managed copy should use existing Copy/input/link/image wrappers and be registered with `prepare:copy`; otherwise the promise that admins can edit website wording will become incomplete.

## 16. Source map for the next agent

- `src/app/page.tsx`, `src/components/home/film-hero.tsx`, `src/components/home/featured-collection.tsx`: homepage.
- `src/components/site-header.tsx`, `site-footer.tsx`, `delivery-announcement.tsx`, `brand-logo.tsx`, `storefront-shell.tsx`: shared chrome.
- `src/app/globals.css`, `src/app/content.css` and route/component CSS: shared tokens, responsive presentation and motion styles.
- `src/app/collection/`, `src/components/collection/`, `src/components/product/`: browsing, gallery and purchase controls.
- `src/components/bag/`, `src/lib/bag/model.ts`, `src/app/api/bag/route.ts`: bag state/UI/trusted quotations.
- `src/lib/catalog/`: mode/configuration, development records, RPC contract and server reads.
- `src/lib/cms/`, `src/components/cms/`, `src/data/cms-copy.generated.json`: content model, replacement wrappers, sections and synchronisation.
- `src/lib/storefront/`: revision/category/public connection state and notifications.
- `src/lib/admin/`, `src/components/admin/`, `src/app/api/admin/`: admin models, Auth, APIs, media and operations.
- `src/lib/contact/`, `src/components/content/contact-form.tsx`, `src/app/api/contact/route.ts`: enquiry flow.
- `src/lib/policies.ts`, `src/lib/cms/policies.ts`, `src/data/store-settings.json`: policy validation/defaults/readiness.
- `src/config/store.ts`: baseline brand/navigation/threshold defaults; published CMS can override supported values.
- `src/lib/environment.ts`, `src/lib/browser-id.ts`, `src/lib/request-deadline.ts`, `src/proxy.ts`, `next.config.ts`: configuration/compatibility/security.
- `supabase/`: SQL migrations, seed/draft imports and bootstrap template.
- `tests/`, `playwright*.config.ts`, `scripts/admin-fixture.mjs`, `tests/fixtures/catalog-api.mjs`: isolated checks.
- `docs/`: master brief, chronological notes, Supabase/admin/contact/business setup, hero documentation and this handover.

## 17. Remaining work - execution order

The developer has authorised checkout, test payments, order records and now point 4 stock management. UK-based store; free delivery at GBP 80 or more; VAT unconfirmed; below-threshold shipping rate awaits the queued Royal Mail integration. Do not interpret this as authorisation for live charges or automatically implementing every remaining phase. The fresh point-3 hosted purchase/admin timestamp acceptance remains pending; it does not block independent point-4 implementation.

### Phase A - Confirm inputs and prepare test-mode checkout

- The developer reports client Stripe dashboard access. Verify test-mode API permissions/merchant readiness when integrating payments, without exchanging secrets in chat.
- Confirm which payment methods to activate: Apple Pay/Klarna/cards first; Clearpay if still wanted.
- Confirm dispatch/service/destination/rate/tax rules and how discounts affect delivery eligibility. Preserve inclusive "GBP 80 or more" threshold semantics (latest clarification).
- Review existing order/coupon/admin record contracts and design trusted payment/order persistence compatible with them. Add appropriate migrations rather than treating browser-editable JSON as payment authority.
- Define checkout sessions, order/item snapshots, payment/provider identifiers, event processing, inventory reservations, coupon redemptions and expiry/recovery data.
- Keep test/live environments distinct. Do not enable real charges just because a checkout button renders.

### Phase B - Checkout and transactional backend

Test-only sessions, orders, reservations, signature checks, idempotency and recovery are now implemented (section 20). Point 4 extends stock safeguards and recurring recovery; its migration installation is verified, while private token/Vault/job activation remains pending. An internal physical-stock commit path is prepared and fixture-tested but cannot be reached by the test-only production provider/schema. The bullets below also include commercial-launch requirements: coupon redemption and live payment activation remain. Do not rebuild the test foundation or treat its presence as completion of commercial checkout.

- The branded guest checkout review UI, customer/delivery validation and server recheck are implemented. Connect the selected hosted Stripe payment flow and complete transactional processing.
- Validate addresses/destinations and offer only configured shipping services.
- Re-read prices, publication, size availability, discounts, minimum order and delivery rules on the server. Calculate total/currency/tax correctly; never trust browser amounts.
- Reserve inventory atomically and avoid overselling concurrent purchases; set reservation expiry and safe release/commit transitions for the chosen payment flow.
- Enforce coupon eligibility/expiry/usage limits atomically, including retries/cancellations.
- Create payment sessions with idempotency and safe provider references; support relevant pending/asynchronous, cancelled, expired and failed states.
- Verify webhook signatures using the required raw body and server-only secret. Record/process events idempotently and handle retries/out-of-order delivery.
- Mark payment/order success only from reliable provider confirmation, never merely from visiting a return URL.
- Connect verified orders/payments/refunds to existing admin Orders and Finance. Preserve immutable purchase snapshots and audit history.
- Add meaningful isolated transaction/security tests and provider test-mode scenarios.

### Phase C - Confirmation, refunds and after-purchase workflows

Private test-order confirmation/status and provider-verified open-session cancellation are now implemented. Commercial confirmation/bag completion, refunds, emails and after-purchase operations remain.

- Build `/order-confirmation` with securely authorised order details, purchased items, totals, shipping and truthful pending/paid status.
- Handle return-to-store cancellation/retry and bag state without clearing the bag prematurely or exposing another customer's order.
- Implement supported payment cancellation and full/partial refunds with consistent financial/inventory state.
- Complete the operational exchange/return workflow around the supplied policy. A self-service returns portal is not yet a selected requirement; email-led handling can be supported through admin.
- Add branded customer emails: confirmation, relevant payment updates, dispatch/tracking, return/exchange acknowledgement and refund confirmation.
- Add admin notifications: paid order, low stock, return/exchange and payment attention. Track send attempts/provider acceptance and retry failures without duplicating messages.
- Consider secure guest order lookup/tracking if desired; accounts are optional, not a prerequisite for guest checkout.

### Phase D - Delivery fulfilment

- Latest developer request (20 October): queue connection to the client's existing Royal Mail account and checkout delivery calculation. Inspect the actual account/services and supported pricing/API access before choosing the rate source; do not assume labels/tracking access includes live retail checkout quotations. Server-validated delivery pricing for orders below GBP 80 is a launch blocker. Preserve free standard delivery at GBP 80 or more and never substitute zero for an unavailable rate.
- Finalise Royal Mail account/services and business configuration.
- Complete a truthful manual fulfilment/export workflow if API access is pending; existing tracking entry can be retained.
- Add Click & Drop/API adapter for order transfer, labels/printing and tracking updates where the actual account supports it.
- Save service, charges, tracking and fulfilment transitions against orders; send dispatch/tracking emails.
- Distinguish service aims from guaranteed delivery promises; do not invent rates or claim automated carrier tracking without an actual connection.

### Phase E - Remaining planned frontend/admin features

- Build the planned header search drawer/overlay with focus, Escape-to-close, matching photo/name/price results and product links. Existing collection search already works.
- Add newsletter signup, explicit marketing-consent handling, secure deduplicated subscriptions and unsubscribe.
- Add owner subscriber viewing/export and the chosen email-marketing delivery integration.
- Complete/review the original homepage's editorial/occasion and "SEEN Promise" sections. Current default homepage has film, curated edit and story preview; flexible media sections are not an implementation of every originally described section. Obtain genuine supporting copy/assets and retain the clean approved design.
- Update all preview/order/payment FAQs and policy paragraphs when their underlying workflows become active.
- Add any needed checkout media-target/copy-registry/preview support deliberately so new pages remain manageable through the CMS.
- Size/availability filters or additional product-detail fields from the original brief can be reviewed here; do not silently restore sorting or gallery features the developer removed.

### Phase F - Final content and business approval

- Obtain/confirm the eighth design and photo mapping; review any products already added in admin before creating duplicates.
- Approve actual names, prices, descriptions, sizes/measurements, stock, fabric/care/fit/accessory information and image descriptions for all products.
- Replace temporary data before commercial launch; do not auto-publish every seeded design.
- Complete legal identity/addresses, delivery/tax settings and privacy disclosures in admin.
- Review final policies and update review date/status only when complete. Confirm the actual delivery/support practices match the published promises.
- Confirm official social links and any additional brand photography; do not add dummy destinations.

### Phase G - Service activation and production configuration

- Configure Resend/Turnstile locally and on Vercel, then verify a real test enquiry reaches the support inbox and Reply-To works.
- Enable/test optional admin inbox ingestion if wanted; configure the server-only writer credential securely.
- Configure/test Supabase Auth email delivery, allowed callbacks, invite/recovery/email-change and MFA flows in the deployed environment.
- Verify required hosted migrations, particularly bulk visibility `005`, role boundaries, private uploads and publication. Do not rerun non-idempotent migrations blindly.
- Connect Namecheap DNS to hosting, verify HTTPS/preferred-domain redirects and confirm the real mailbox/email DNS without disrupting MX.
- Configure actual production origins, provider webhooks/returns, environment scopes and secrets.
- Confirm client ownership/billing/access for Supabase, Vercel, domain, email, payments and courier services. Personal development ownership is not the final business handoff.
- Configure shared auth/contact abuse limits, error/uptime monitoring, payment/email failure alerts and backup/restore procedures.

### Phase H - SEO, performance, acceptance and handover

- Add XML sitemap/robots.txt and complete canonical URLs/Open Graph/social preview images. Basic titles/descriptions already exist; do not describe all SEO as absent.
- Add accurate Product/Organization structured data using actual business/product/availability facts; existing visual breadcrumbs already exist.
- Consider meaningful product slugs with redirects from current design-reference URLs; don't break existing product links or CMS targets.
- Enable indexing only after approved content and production settings are ready; protect private previews separately because noindex is not access control.
- Test real Android Chrome and iPhone Safari plus desktop/tablet, rotation, reduced motion, slow/offline recovery, keyboard and screen-reader paths.
- Verify full order-to-dispatch flow, failed/pending/duplicate payments, concurrent stock, coupons, threshold boundaries, cancellations/refunds and emails in test mode; coordinate any genuine live payment/refund test explicitly.
- Measure production media/performance and improve bottlenecks while preserving original brand media and functionality. Do not add extra motion merely for quantity.
- Run appropriate build/type/database/browser/security checks after changes. A passing emulated suite is not physical-device validation.
- Provide admin training, an editing/fulfilment/refund guide, ownership/access inventory and operational recovery instructions.

### Later optional work

Customer accounts, order history/addresses, wishlist, product reviews, analytics, abandoned-cart marketing, loyalty, full accounting/bank reconciliation and a self-service returns portal are not completed launch promises. Confirm their scope before building them. Larger-volume admin pagination becomes necessary before the existing record-list cap is exceeded. Assess consent requirements before optional tracking/marketing is introduced.

## 18. Known deployment warnings

The developer supplied Vercel logs with successful builds and warnings about `engines.node >=22.0.0` and npm `cache-dir`.

- Node engines were changed to **24.x** in package and lockfile; a production build passed afterward. Deploy the current commit for that fix to reach Vercel.
- No repository `cache-dir` setting was found. Check hosting for obsolete `NPM_CONFIG_CACHE_DIR`/`npm_config_cache_dir` and remove if present; npm's valid cache-path setting is `NPM_CONFIG_CACHE`. If absent, the warning may come from the surrounding build environment.
- These warnings did not indicate a failed application build. Do not invent another fix without inspecting current deployment logs.

## 19. Working agreement and restart instructions

- The developer values action, clear short explanations and complete handling of all requested UI details. They are learning the setup; explain a necessary manual step with the exact file/page and expected result.
- Preserve the approved responsive luxury direction and existing CMS workflows. Do not redesign working pages or replace the architecture without a reason and agreement.
- Build/review the next coherent phase when requested. Ask only for missing decisions/access that actually block it, while continuing independent authorised work.
- Keep credentials out of chat/logs/Git. Explain integration limitations truthfully. Do not report a mock success as a live result.
- Do not silently perform hosted inventory changes, real charges/refunds, destructive operations, commits/pushes or production publication as part of a read-only status/handover task.
- The prior agent did not commit/push/deploy its changes; the developer has committed changes between turns. At this handover's initial read, the worktree was clean and HEAD was `a080969` (`changed mobile home page`). The handover/README and later checkout-preview changes are on top of that snapshot; inspect current status. Inspect current Git state before proceeding.
- No project `AGENTS.md` was found during the repository review. Recheck applicable instructions in the next environment. Tool permissions/account integrations can differ after switching accounts.

Suggested first message for a new coding-agent chat:

> Open this existing folder and read docs/PROJECT_HANDOVER.md first, then inspect the current code and Git state. Continue SEEN ABAYAS from its existing checkpoint; preserve the approved film homepage, shared Supabase inventory and admin CMS. Tell me the next concrete phase and any client-side setup needed. Do not rebuild completed features or expose credentials. Follow my next instruction before starting an integration.

This document supplies project continuity, not the exact original conversation or the previous account's tools/permissions. Refresh its dated live observations and update it after substantial work so the next handover stays reliable.

## 20. Payment implementation checkpoint - 20 October 2026

**Latest verified deployment:** the developer pushed `aff54b1` (`added payment method checkout`), saved the Vercel settings, set `PAYMENTS_MODE=test` and redeployed. Checkout is deployed (200) and webhook GET is 405 as expected. Unsigned webhook POST is rejected (400); a signed synthetic diagnostic with a nonexistent order safely reached the protected order lookup and returned 200. This did not create an order, reserve stock or create a Stripe event/session/payment. The first completed card checkout and its actual provider event were subsequently verified; see the latest provider evidence below. Separate BNPL/wallet tests remain pending.

Public checkout review now confirms test mode/payment availability, trusted GBP 150 totals/GBP 0 standard delivery for two size-52 Layla Burgundy abayas, a review fingerprint, private/no-store response and a Secure/HttpOnly/SameSite=Lax owner cookie. Public catalogue read currently exposes one published design with sizes 52/54/56/58/60 available; this is a dated observation, not a fixed stock guarantee. Stripe's default sandbox payment-method configuration independently reports card/Apple Pay/Klarna/Afterpay-Clearpay available and display on. Method/device/customer eligibility still applies. The developer has been asked to complete the first hosted card sandbox test from their own browser using official Stripe test values and fictional customer details. No agent-created payment/order or hosted stock mutation has occurred. Local mode was not edited; Vercel mode was verified remotely. Earlier disabled/404 statements in this document record prior checkpoints and are superseded here.

Latest continuation: the developer confirmed the requested Vercel Production environment settings were saved. Private Vercel values were not independently inspected. Fresh public checks still returned 404 for `/checkout` and `/api/payments/stripe/webhook`; the current source changes remain uncommitted on `main`. Next: the developer commits/pushes the tested changes, waits for deployment, and then verifies/activates test mode. No deployment or payment has been triggered by the agent.

This section supersedes older statements that Stripe is not installed, payment endpoints/confirmation are absent, or every part of phases A-C is unimplemented. The developer explicitly authorised connecting all four requested methods. This is a **test-only integration**, not authorisation for real charges, live inventory sales, refunds or automatic deployment.

### Implemented

- Stripe SDK **23.0.0**, hosted redirect, GBP integer-pence line items and Royal Mail rate selected from published settings. Dynamic eligibility is restricted to card/Klarna/Afterpay-Clearpay, with Apple Pay as a card wallet. No client payment library or separate payment catalogue is added.
- Server review fingerprints and database rechecks protect prices, stock, delivery fees and minimum totals. Unknown delivery charges block payment. Free standard delivery is inclusive at GBP 80 by default. VAT remains unconfirmed; automatic VAT calculation/live charging are disabled.
- `20261020000100_payments.sql` creates private `checkout_orders`, immutable `checkout_items` snapshots and `stripe_event_receipts`; exact product/variant locking plus atomic shared-stock reservation, bounded owner sessions, idempotent creation and service-role-only RPCs.
- New RPCs: `payment_health`, `payment_get_order`, `payment_get_request`, `payment_prepare_order`, `payment_apply_session`, `payment_pending_orders`, `payment_release_orphan`. Public/ordinary authenticated roles cannot execute them. The server checks browser ownership before passing a server-authorised order to the customer.
- Checkout review establishes random HttpOnly/SameSite=Lax `seen_checkout_owner` ownership before reservation. HTTPS cookies are Secure. Customer confirmation/status requires its hash, never just an order ID or return URL. Only random ownership/IDs are browser tokens; no contact/address/card data is stored in browser storage.
- Provider session creation/customer prefill uses stable idempotency keys and a frozen one-hour expiry. Network-response retries recover the same order. Signed snapshot webhooks re-fetch Stripe state, validate test mode, references, amount and currency, and apply events idempotently. Pending asynchronous payments keep stock reserved; paid/failed/expired updates settle it safely. Late inconsistent success becomes an attention case rather than an oversold fulfilment.
- `/order-confirmation` has private open/pending/paid/failed/expired/attention states, bounded polling, retry, explicit provider-verified cancellation, addresses/items/totals and responsive motion. URL flags cannot establish payment success. The bag is deliberately kept for sandbox retesting. There is no claim that a transactional email has been sent.
- Test success releases reservations without selling physical stock. Admin rows are labelled **Test / Do not dispatch**, cannot be fulfilled, and are excluded from commercial order/revenue totals. Existing commercial fixture/admin records retain their original behaviour. Admin edits cannot forge payment status.
- Owner-only `POST /api/admin/payments/reconcile` and **Refresh payment statuses** process up to five rotating pending orders. Optional scheduled `GET /api/payments/reconcile` requires a private Bearer `PAYMENTS_RECONCILE_SECRET` (at least 32 characters). No scheduler is installed. Provider uncertainty retains reservations. Orphans release only after exhaustive bounded provider lookup plus expiry grace; attention holds need owner investigation.
- Configuration requires a test Stripe key, correctly typed Supabase server key, webhook secret, source modes and valid runtime site origin. Live mode/keys are rejected. Hosted redirects require no CSP broadening or embedded Stripe browser script. Public checkout/confirmation copy is registered with the existing CMS, and confirmation supports media/draft-preview targeting without exposing customer orders.

### Setup and hosted evidence

The developer reported all four methods enabled, applied the new payment SQL successfully, and corrected the Supabase server key privately. The latest **read-only** check confirms Stripe test connectivity, Supabase connectivity and installed protected `payment_health`. An earlier public-read success with the wrong server key did not establish protected payment readiness; it was diagnosed with error code 42501 and corrected. The API credentials were never printed.

The developer cannot use Stripe CLI under the current invitation. Use Dashboard **Workbench / Developers > Webhooks > Create an event destination**, **Your account**, **Snapshot**, and the four events listed in [STRIPE_SETUP.md](STRIPE_SETUP.md). Public test origin confirmed by the developer: **https://seenabayas.vercel.app**. Endpoint: **https://seenabayas.vercel.app/api/payments/stripe/webhook**. This is the intended endpoint; the agent has not deployed it or verified hosted webhook delivery. The developer created the destination and added its signing secret privately; a subsequent read-only check reports webhook configuration present and protected payment health ready, with `PAYMENTS_MODE` still disabled. A public GET currently returns 404 for the endpoint, so the code still needs deployment. Vercel environment setup has been requested. Local keys do not configure Vercel. Deployment protection must not block provider POSTs.

### Remaining within the payment phase

- Finish Dashboard signing-secret configuration, configure matching Vercel environment scope/site origin, deploy this code, and set `PAYMENTS_MODE=test` only when the setup is ready.
- Verify an actual Stripe sandbox order and actual Dashboard event delivery, each requested method where eligible, provider failure/cancellation/pending states and real Apple Pay device behaviour. Local simulated tests do not prove provider method availability or physical-device behaviour.
- Implement coupon redemption/atomic usage, commercial tax/shipping decisions, eventual live mode with real stock commit, deliberate bag completion/recovery, refund initiation/provider-refund synchronisation, transactional emails and fulfilment. These are not implemented by this test foundation.
- Configure scheduled reservation recovery, shared abuse protection/monitoring, final policies/retention/business details and full launch acceptance. Do not process real charges/refunds or dispatch sandbox orders.

### Source and test map

`src/lib/payments/{config.mjs,model.ts,http.ts,server.ts,provider.ts,reconcile.ts}` hold configuration, schemas, ownership, provider trust and recovery. Checkout APIs are under `src/app/api/checkout/`; webhook/reconciliation under `src/app/api/payments/`; owner recovery under `src/app/api/admin/payments/`. Confirmation lives in `src/components/checkout/order-confirmation.tsx` and `src/app/order-confirmation/`.

`npm.cmd run check:payments` is read-only and reports booleans/error codes, never raw provider errors or credentials. `test:payments-ui` runs an isolated local Stripe simulator plus actual SQL through PGlite. `PAYMENTS_FIXTURE_ORIGIN` works only with exact dummy credentials and loopback Supabase, and cannot be used with real keys/hosted data. Admin/checkout/mobile/payment suites share ports and must run sequentially. Build before browser checks. See development notes for the final run results; do not add older overlapping test counts together.

Final local verification for this payment checkpoint: production build passed, 75 database/model checks passed across the full/focused runs, all 12 distinct payment UI checks passed across the final completed run/focused admin rerun, all 11 disabled-payment checkout checks passed, 13 catalogue/bag checks passed, and five phone policy checks passed. Confirmation screenshots were reviewed. The three actual configured payment secrets were absent from current publishable source and browser bundles; .env.local is ignored/untracked. No physical wallet/device or actual provider sandbox purchase has been verified. No source code changes were made after the final build; only test-wait/documentation adjustments followed.

Latest provider verification: the user completed the card sandbox test. Read-only checks confirmed a paid test PaymentIntent/Checkout Session, matching private paid order at GBP 225, released reservation, actual completion event with zero pending webhook deliveries and the intended enabled test endpoint. No customer details or card number were printed. The provider method was card, with the published Visa success-test suffix and a simulated CVC pass. The user clarified their allegedly invalid details were the supplied 4242 test number with a changed CVC; any valid three digits are expected for that test card. This did not require a code fix. Klarna and Clearpay were both visible. Clearpay approval is the next requested user test; detailed official UK Klarna fixtures, explicit card decline values and Apple Pay wallet testing requirements are now in STRIPE_SETUP.md. No additional payments/stock writes were initiated by the agent.

Subsequent Clearpay verification (20 October): the developer completed the sandbox redirect and returned successfully. Independent read-only queries found method afterpay_clearpay, succeeded PaymentIntent, paid test session, matching private paid order at GBP 300, released reservation and a completion event with zero outstanding webhook deliveries. Card and Clearpay success are now verified separately. Klarna success and physical Apple Pay remain pending; official UK Klarna fixtures were supplied for the next user-run checkout. No application changes or agent-initiated payment/stock mutations were needed.

Current Klarna blocker (20 October): laptop Chrome reaches pay.test.klarna.com but shows a white page after arbitrary customer details. Stripe/database read-only checks found two unpaid Klarna sessions awaiting action; their matching private orders remain open/reserved with no provider last-error/decline code. Root cause of the external page failure is unconfirmed. Cancel abandoned sessions via SEEN, retry official approved UK fixtures, then collect a sanitised first console/network failure or compare an extension-free browser if necessary. Do not copy private provider redirect links into documentation. No payment or stock mutations were performed during diagnosis; Klarna/Apple Pay acceptance remains pending.

## Catalogue update - 20 October 2026

All nine photographed designs now have a client-confirmed price. The old plain charcoal photo is Teal (GBP 40), botanical detail is Black Sequin (GBP 50), textured blue/charcoal is Tie Dye Blue (GBP 40), and the additional Polka Dot design is GBP 45. The new Brown and Olive designs are GBP 40 each; Burgundy Roselle and Cream are GBP 45; Black Lace is GBP 50. The latest source is assets/catalog-release-20261020.json. Earlier agent-chosen names/prices are superseded for the actual hosted catalogue.

Only Burgundy Roselle has supplied stock: size 54 x 1, 56 x 1, 58 x 2. All other designs are to be visible but sold out. Size labels are 54/56/58; the client-supplied rounded centimetre lengths and suggested heights are shared by the full size-guide page and product dialog through src/data/size-guide.ts. Old 52/60 sample lengths are retired by the import without deleting order-linked variant IDs. The isolated development catalogue remains historical test fixtures and is not a production stock source.

Seven newly supplied photos were organised into assets/source/products/design-08 (Brown, four views) and design-09 (Olive, three views), preserving original bytes/hashes in assets/source/catalog-intake-20261020.json. There are now 22 product photographs across nine designs, plus the prepared logo. WebP copies strip metadata without retouching. Existing references 01-07 remain stable.

The pre-import read-only hosted inspection found all seven old products still present: design-01 published, 02-07 draft without saved photos or sizes. The developer subsequently deployed the new assets and confirmed running supabase/catalog-release-20261020.sql with nine published results; independent public checks verified the resulting catalogue. No hosted records were deleted or imported by the agent. The transaction backs up affected records privately, preserves IDs/costs/categories/additional uploaded photos, restores missing records, publishes all nine and sets only the supplied stock. It aborts atomically while any affected stock is reserved. Never manually zero reservation counters. A repeated successful batch is a no-op to protect later stock/admin edits. Future changes should use admin. See docs/CATALOG_UPDATE.md for the retained import instructions. No live payment mode or checkout trust rules were changed.

Catalogue verification at this checkpoint: final production build passed; eight focused database/catalogue-contract checks, four size-guide browser/accessibility checks, six responsive collection layout checks and three new-gallery/search checks passed in isolated environments. Brown phone and Olive desktop screenshots were reviewed; sizing/customer-care link spacing was polished. These are local/emulated checks, not proof of hosted import or physical-device validation. No hosted data writes were made.

Hosted publication verification (20 October): after the developer's deployment/import, independent checks found nine published records matching every approved name, price and description, 22 reachable images, nine working product URLs and nine rendered collection cards. Read-only availability requests verify Burgundy limits 54=1, 56=1, 58=2, with no available sizes on the other eight designs. A temporary Pixel 5 touch-emulated browser against the deployed site successfully added Burgundy 54 at GBP 45, displayed Brown as sold out and showed the supplied size chart. Phone/desktop collection checks found no horizontal overflow; no page JavaScript errors were observed. No order/reservation/hosted stock write was created by these checks. These are dated availability observations and emulated checks; subsequent admin changes take precedence and physical-device validation remains separate. The catalogue import/deployment task is complete; Klarna and Apple Pay acceptance checks remain pending.

## Point 3 - Order record continuation checkpoint - 20 October 2026

The user's next selected phase was automatic order creation. This is implemented on the existing test-only checkout foundation, with no new parallel order database and no automatic live activation. New migration: supabase/migrations/20261020000200_order_records.sql (apply after the installed payment migration). It adds one-time observed payment/confirmation timestamps, unique provider PaymentIntent ownership, purchase snapshot/total/identity and confirmed-contact update guards, canonical admin projections and repair on verified retries. It backfills display fields for old records without inventing historical confirmation times or modifying stock/payment objects. Missing/invalid paid references and unpaid manual confirmation are rejected. Private RPC/admin MFA/role and session ownership restrictions remain.

Admin now renders order contact/address/items/quantities/sizes/unit and line totals, original totals, dates and optional provider references through src/components/admin/order-details.tsx. src/lib/admin/orders.ts handles legacy-safe display and item-level CSV with spreadsheet formula protection. Filters separate payment, fulfilment and test/customer records. Existing owner notes/tracking survive replay. The 1,000-record snapshot/export cap remains. src/lib/payments/provider.ts now validates the final provider email/phone together with the final shipping address. scripts/check-payments.mjs reports orderRecordsReady.

Final validation: production build, 82 database/model checks and all 14 isolated payment/order browser checks passed. The database suite was rerun after adding the required paid-reference constraint; browser valid-reference cases passed on the final app build. Phone/desktop order screenshots were reviewed. Test success appears in admin without visiting the customer return page. These are local fixture checks, not hosted activation or genuine charges. No hosted data/schema/payment changes were made by the agent. Developer must run the new migration and deploy current code; docs/ORDER_SETUP.md has exact steps. No new environment keys or webhook events are required.

Point 4 remains the next selected phase after installation/verification: extend inventory for commercial/live operation and scheduled reservation recovery. Existing sandbox reservations and release already work, but paid tests deliberately do not sell physical stock. Do not claim point 3 enables genuine customer charges or that Klarna/Apple Pay acceptance has been fully verified. Live activation, outstanding commercial inputs and remaining phases still apply.

Hosted point-3 follow-up (20 October): developer reports SQL applied and deployment Ready. Independent private health verifies order_records_ready=true/test_only=true. Both earlier paid test orders have intact item/contact/address snapshots, matching totals and released reservations; new timestamp fields exist but remain null for historical orders. Public checkout review verifies test payment availability and GBP 90 for two Burgundy size-58 pieces. Unauthenticated admin API/order routes correctly reject/redirect with private/no-store responses. No authenticated hosted admin view or fresh post-migration order has been independently inspected yet. One user-run fresh sandbox purchase/admin confirmation is requested to verify actual new timestamp capture; do not claim that historical null dates are a bug or invent/backfill dates. No orders, payments or stock/schema mutations were made during these checks.
