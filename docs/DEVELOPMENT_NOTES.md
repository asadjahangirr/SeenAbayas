# Current development decisions

## Temporary sizing and stock — 19 October 2026

The developer explicitly requested sample sizes and quantities so the shopping bag can be tested before real inventory is supplied. Use the `development` catalogue locally:

- Seven existing photographed designs, using the names and opening GBP prices already selected.
- Length options: 52, 54, 56, 58 and 60 inches. These are common retail length options, not confirmed measurements or fit specifications for SEEN garments. No body measurements or fabric claims have been invented.
- Five sample units per length for every design, giving 35 temporary variants.
- Source: [development-catalog.json](../src/data/development-catalog.json).
- The server validates bag prices, variant IDs and requested quantities against this sample catalogue. Bag additions do not reserve or decrement stock. Orders and payments are not enabled.
- A visible preview notice identifies sample data. Development mode cannot enable search indexing. Sample bags use a different storage key from live Supabase bags.

This is a local development catalogue. It does not write sample inventory to the connected Supabase project. `CATALOG_SOURCE=supabase` continues to use only published database records and the database quantity-check function; it never falls back to sample merchandise.

Length reference: [Aab's sizing information](https://us.aabcollection.com/pages/faq). Client-specific size labels, lengths and fit measurements must replace these assumptions before real sales.

## Admin dashboard — later phase

The developer plans to edit product details, sizes and stock through a protected admin dashboard. Build it against the Supabase products, product variants and private inventory tables, with server-side admin authorization. It should manage names, prices, descriptions, photography mapping, variant labels, actual stock and publication status.

When connecting real admin-managed inventory, replace all sample stock and sizing, verify the database bag migration, publish approved products and switch `CATALOG_SOURCE` to `supabase`. Keep indexing disabled until launch checks pass. The existing publication constraints remain required; do not bypass them to publish incomplete products.

## Storefront direction

The homepage is a brand introduction plus a curated four-piece edit. Collection is the complete catalogue with a compact heading, search, filters and sorting. Product cards and hero photographs link to product pages. Product photographs magnify in place on hover, with touch and keyboard alternatives. No quick-view popup, View more pieces control or Another view badge is required.

## Brand and customer care pages — 19 October 2026

The first content batch adds `/our-story`, `/contact`, `/size-guide` and `/faqs`. The desktop navigation retains four primary links, with Story and Contact now opening dedicated pages. Size Guide and FAQs appear in the mobile help menu and footer. The homepage story preview links to the full story. Product pages have a native size-guide dialog with a link to the full page.

Our Story preserves every official brand paragraph from `MASTER_PLAN.md`, using supplied garment photography rather than invented founder portraits. Content uses the existing editorial typography, finite scroll reveals, gentle photo hover effects and reduced-motion support.

The size guide contains measurement instructions, an illustrative garment photograph and mathematically accurate inch/cm conversions for the temporary length labels. These are explicitly not confirmed SEEN garment measurements. Chest, sleeve, fit and actual garment lengths still need the client's data. Replace the temporary reference when real size charts are supplied; do not infer fit recommendations from length alone.

FAQ answers reflect the current preview: ordering, payment methods, dispatch estimates and automated tracking are not active. Update these answers when checkout and fulfilment are implemented. Shipping and policy pages remain the next content batch. Customer-facing URLs now total fourteen (seven product pages plus seven other pages), against the planned twenty-two; the eighth product is still awaiting photography.

The contact form validates name, email, phone and message on both client and server. Its Resend adapter and Turnstile verification are implemented, but actual sending requires the developer's service configuration and a verified support inbox. See [CONTACT_SETUP.md](CONTACT_SETUP.md). Sending is disabled when configuration is missing. Real delivery has not been tested, and policy/hosting abuse controls must be completed before launch.

## Delivery and policy pages — 19 October 2026

The next batch adds `/shipping-delivery`, `/returns-exchanges`, `/privacy-policy`, `/terms-conditions` and `/cookie-policy`. The storefront now has nineteen of the planned twenty-two customer-facing URLs; Checkout, Order Confirmation and the eighth product page remain. Admin screens are separate from that count.

The developer supplied the original client message again, confirming the story, full returns copy, contact fields/email, Royal Mail preference, £80 threshold, intended `www.seenabayas.co.uk` domain via Namecheap and desired payment methods (pay now, Apple Pay, Klarna, Clearpay). This does not supply legal trading details, postal addresses or shipping charges. Payment options remain pending merchant configuration and eligibility.

All policy pages remain visible **drafts**, with search indexing disabled for those routes. Unknown business, delivery and privacy fields are kept as null in `src/data/store-settings.json`; they must remain distinguishable from confirmed zero/false values. The later secure admin should manage these settings. See [BUSINESS_SETUP.md](BUSINESS_SETUP.md) for supplied facts, missing inputs and source references.

The official returns paragraphs are preserved. A separately labelled cancellation section and optional text download provide an accessible email route without requiring an exchange or a reason for eligible cancellation. No cancellation or other email is sent automatically. Delivery links go to the real Royal Mail service/tracking pages; no carrier integration or fabricated fee/timeframe is represented as active.

The footer now follows the planned four groups with warm ivory styling. Shipping and Returns are available from the mobile help menu; the animated delivery banner and product delivery link open Shipping. Contact links to Privacy. The cookie page has a functional saved-bag clearing control, including blocked-storage feedback; unrelated local storage is preserved. There is no optional tracking tool to justify adding a non-functional consent banner.

Next major implementation: authenticated admin access and product/inventory management, followed by checkout, payment events, orders, dispatch and email workflows. Remaining homepage sections and launch integrations still need completion.

## Optional film hero study — 19 October 2026

The developer requested a temporary alternative using the supplied `add.mp4`, with only the SEEN lettering moving from the lower centre of the film into the navbar. The existing photo hero remains the default at `/`; the flag-controlled comparison is `/?hero=film`. See [HERO.md](HERO.md) for preparation and behaviour. Comparison links are visible only when this local study is enabled and both ignored media assets exist.

The exact supplied letter shapes are isolated with an SVG mask. GSAP ScrollTrigger is loaded by the film component for a reversible, scrubbed move and scale. Playback is muted, with explicit pause, offscreen/hidden-tab pausing, still-image fallback and opt-in playback under reduced-motion/data-saving preferences. The navbar, collection links, sample bag and remaining homepage sections continue to use their existing implementations. No deployment or hosted database writes are part of the study.

Validation: production build and fourteen distinct film browser checks passed, including focused reruns after the final landscape/touch adjustments. Eight original-homepage regression checks passed. Screenshots were visually reviewed on desktop, portrait phone and landscape phone. Actual iOS/Safari hardware remains a separate device check.

## Film homepage and updated logo — 19 October 2026

The developer then supplied `logo-removebg-preview.png` and requested the full emblem-plus-SEEN artwork without its lower tagline. The unchanged source is saved at `assets/source/brand/seen-transparent.png`; `npm run prepare:brand` frames it in `public/images/brand/seen-signature.svg`. The SVG keeps the supplied raster pixels; it is not a traced vector. The navbar, footer and moving hero logo now use the same signature.

With the existing local film flag enabled and both media files present, `/` now opens the film as the main hero. `/?hero=photography` retains the original comparison layout without visible testing links. Development/comparison banners and video playback buttons were removed as explicitly requested. Sample data, blocked checkout and draft policy status remain unchanged. The film remains local and ignored by Git; no deployment was requested.

The slogan and collection link sit at the lower left. Responsive logo size/position gives small portrait phones a separate vertical space and moves the logo to the right on short landscape screens before it docks into the centred navbar. Playback remains muted/inline/looping and pauses offscreen/in hidden tabs. Reduced-motion/data-saving and autoplay/load failures use the poster; no manual playback controls are rendered. The actual clip is 1280 × 720, not Full HD; no upscaling or extra compression is applied to the source video.

Validation: production build passed; fifteen distinct film checks passed, with final desktop reruns after correcting a test's assumption about the existing 48 px page gutter. Nine photo/navigation regression checks and two sample shopping checks passed. Screenshots of the prepared logo, desktop/phone/landscape hero and docked navbar logo were reviewed. No physical iOS device test or deployment was performed.

## Transparent film navbar — 19 October 2026

The developer requested removing the white navbar background over the initial film view, then restoring it when the logo docks. The film header is now a fixed overlay below the existing black delivery announcement, and the hero extends behind it. The shared ScrollTrigger timeline fades in the white surface and changes text/icons/divider to the existing dark styling during the final docking segment. Upward scrolling reverses both. A soft upper video gradient keeps the initial white links/icons readable. Reduced motion immediately uses the solid header and docked logo; normal navigation restores the ordinary white sticky header with animation styles cleaned up.

Validation: production build and all fifteen film browser checks passed. Checks now verify the transparent and solid header colours, video extending behind the navbar, reverse scrolling, eight viewport layouts, resize, reduced motion and restored sticky/white styling after client navigation. Desktop and phone screenshots before/after docking were reviewed. No deployment was performed.

## Collection search, sorting and shipping banner — 19 October 2026

The developer requested searching before a complete colour/name is typed, removal of The SEEN edit sort option, and removal of the free-shipping banner's pause button. Collection search now normalizes case/accents and matches word beginnings across displayed product names, photographed colours, colour aliases and structured visual descriptions. Burgundy also matches red/maroon/wine, and charcoal matches grey/gray; displayed product names and colour labels are unchanged. Incidental letters in generic photo alt text no longer cause unrelated matches. Each search word must match, and the selected colour filter still applies.

Sorting now offers only Alphabetical A–Z and Z–A, with A–Z selected by default. The banner remains animated and links to Shipping, but has no pause/resume control or empty control column. Hover/focus still hold the text for reading; reduced motion retains the static single message. Local catalogue sample sizing/stock and disabled checkout are unchanged.

The production build passed. Ten direct Node checks against the actual filter declarations passed, covering partial colour/name terms, accents/case, multiple words, selected colours and empty-search reset. Static checks confirmed the A–Z default, removed SEEN edit option and removed banner button. Updated browser coverage includes these searches on phones/desktop, sorting, filters and banner behaviour, but could not run: automatic approval review failed due to capacity, and both allowed retries timed out before execution. Browser interaction/visual verification remains unconfirmed for this update. No deployment or hosted database changes are part of this update.

## Permanent video homepage - 19 October 2026

The developer selected the video design as the permanent homepage and authorized removing the earlier picture-based hero. The homepage now always renders FilmHero. The photo lookbook component, its CSS/animations, comparison rendering and preview flag/helper have been removed. Product photographs and the four-piece homepage edit remain in use.

The selected video/poster are now included at public/videos/home/hero.mp4 and public/images/home/hero-poster.webp, with source hash/provenance in assets/home-hero.json. Their bytes match the supplied original/prepared poster. No media flag or local preparation is needed for ordinary development or builds. The optional replacement utility is now npm run prepare:hero. Retired comparison query parameters cannot render the photo hero. See [HERO.md](HERO.md). The superseded temporary video/poster/manifest copies were removed only after verifying the canonical replacements. No deployment or Git commit/push is included in this update.

Validation: the production build passed. Direct checks verified the unconditional FilmHero render, removed photo component/helper/styles, required media files and matching SHA-256/bytes. Git checks confirm that the canonical media is not ignored and .env.local remains ignored. Browser checks were updated for the permanent homepage, legacy query handling and video range/poster responses, but could not start: automatic approval review timed out on both attempts. Browser interaction/network validation remains unconfirmed for this update.

## SEEN administration and editable storefront — 19 October 2026

Inspected the supplied previous project at commit `6376a8970ff970f7cc73a2de0005d848db23828b`. Its source remains in ignored `.reference/pd`; none of its scripts or dependencies were executed. See [ADMIN_REFERENCE.md](ADMIN_REFERENCE.md) for the adaptation and [ADMIN_SETUP.md](ADMIN_SETUP.md) for activation.

Implemented `/admin` with fourteen management areas: overview, products/stock, categories, orders, inbox, finance, coupons, hero video, media, website text, appearance/motion, store settings, publication history and account security. Products support photos, prices, private cost, sizes/SKUs, inventory, bulk stock/archive and ordering. Operational records retain history and cannot forge payment state. Finance reports recorded payments and expenses without assuming accounting profit. Coupon redemption still belongs to future checkout.

Supabase Auth uses invitation-only database membership, owner/editor permissions, verified sessions and mandatory TOTP MFA. Fresh authorization and origin checks protect mutations; database policies protect private tables, draft documents, costs, inventory and uploads. Password/email changes and PKCE password recovery require fresh authenticator verification. There is no public admin registration or default password. The new migrations and owner bootstrap are prepared but have not been applied to the hosted project.

A registry connects 510 storefront text entries to draft/published CMS content, including navigation, forms, policy wording, image descriptions and metadata. Private preview follows customer routes and includes saved unpublished products. Explicit publication, concurrent-edit protection and thirty retained content revisions support review and rollback. Images/logos can be replaced, and private JPEG/PNG/WebP/MP4 uploads become public only when referenced by published content/products. The hero keeps the chosen video design and docking logo, with ordered clips, poster and editable button destination. New GSAP scroll-reveal and lift/magnetic/sheen hover presets respect reduced motion and touch input. Delivery thresholds update the banner, policy wording and bag calculations independently of prices.

Validation: production build and all 51 database/model checks passed. Sixteen distinct admin browser checks exercised all sections, CRUD/publication, MFA, recovery/email changes, private previews, media access, published delivery/copy changes through bag additions/removals, and responsive accessibility at 320/390/768/1440 px. All 97 distinct storefront checks and fifteen film checks passed across completed suite runs and focused reruns. This supersedes the earlier browser-validation limitations above. Provider fixtures remain isolated from the actual Supabase project; real hosted authentication, email and storage configuration still need the activation checks in the setup guide. No physical iOS/Safari device check or deployment was performed.

Checkout/payment events, coupon redemption, order reservations, refunds, courier labels and transactional order emails remain future integrations. The optional verified contact inbox needs its documented server-only provider configuration. Current operational lists are capped at the latest 1,000 combined records, with global financial/count queries independent of that cap. The existing `.env.local` remains ignored and untracked; no Git commit or push was performed.

## Live admin/store synchronization and editing guidance — 19 October 2026

The reported missing products/categories had two concrete causes: `.env.local` still selected the temporary development catalog, with file-based CMS content, and category navigation was derived only from products already visible in the collection. Local catalog and CMS sources now both select Supabase, preserving the configured URL/key. The product RPC now uses the extended catalog independently of the content source, with compatibility for catalog-only installations.

Added `20261019000300_storefront_sync.sql`, with a private revision row, transactional triggers and a public read exposing only a revision and category name/slug/description. All saved categories, including empty ones, can appear in the collection menu. The user applied the migration and reported “Success. No rows returned”; read-only requests then confirmed HTTP 200 for the site document, extended catalog and storefront state. At that check the project exposed one published product and one category; no website-content document had been published. No hosted product/content records or accounts were changed by the agent.

Active store tabs check the revision every two seconds, with immediate same-browser notifications, focus/reconnection catch-up and failure backoff. Page data refreshes only on a changed public revision, preserving customer state and scroll position. Bag quotes refresh after public changes. Unacknowledged page refreshes remain retryable, and visited routes track revisions to avoid returning to stale data. Draft publication remains explicit. The mechanism needs no browser database credentials or Supabase Realtime subscription. A compatibility read keeps catalog-only installations usable before the new migration is installed.

Simplified the admin: website content uses Save & update store; new products default to Visible in store with a clearly labelled Save & show in store action. Existing hidden drafts remain private until that visibility is selected and saved. All monetary inputs accept pounds while APIs/database retain integer pence. Added direct product photo uploads, automatic category slugs, form reset/closure only after successful saves, clearer validation and connection status, editor focus/scroll, and How to use this page instructions for every section. Admin navigation avoids prefetched stale snapshots. The copy registry now has 513 entries. Homepage selection offers published pieces and supports hiding the edit; recommendations ordering remains separate from the collection's requested alphabetical sorting.

Validation: production build passed. Across the completed runs, all 53 database/model checks, 21 admin browser checks, 13 catalog/bag browser checks and 19 collection/homepage regressions passed (106 distinct checks). This includes independently opened visitor sessions receiving new products, empty categories, published copy, updated bag prices, homepage choices, colours and magnetic hover effects without manual reload. Saved drafts remain private. Responsive/accessibility checks and screenshot review cover phone/tablet/desktop widths; no physical iOS/Safari test was performed. The Supabase public sync migration/read path was verified live, while automated mutation tests used isolated provider/database fixtures. `.env.local` and the reference checkout remain ignored; no commit, push or deployment was performed.

## Product deletion and reusable uploads - 19 October 2026

Promoted Add product to the Products & stock heading and added owner-only Delete product to each saved product. The new `20261019000400_product_delete.sql` function requires MFA, checks the latest saved revision and refuses deletion when stock is reserved or an order references the product or its variants. It removes unused sizes/inventory and the deleted design's current homepage selection without publishing unrelated draft changes. Uploaded files remain reusable. The user reported applying the migration successfully; no hosted product was deleted by the agent.

Added a shared searchable visual picker with direct computer uploads for images and MP4 videos. JPG, PNG, WebP and MP4 remain limited to 25 MB each, with up to 20 files per batch. Original filenames are stored as upload metadata for easier selection, while Storage object paths remain immutable UUIDs. Existing image/video slots select compatible formats. Uploads stay private until referenced by published content or products.

Media library now offers Use on a page and a reusable section editor: choose a customer page, all product pages or an individual product, place media before/after its content, add descriptions/captions/video posters, select framing and reorder/remove placements. Save draft retains private previews; Save & update store publishes sections through the existing live synchronization. Up to 24 sections are supported. Page videos have native playback controls and do not autoplay. Removed-product targets remain visible for retargeting. Setup and reference guides explain the workflow.

Validation: final production build and all 57 database/model checks passed. All 25 distinct admin browser checks passed across the completed suite and a focused rerun; the upload/reuse check initially used an exact implicit-label locator that included select-option text, corrected to the combobox's accessible name. Coverage includes owner deletion and open-store refresh, reservation/order/permission guards, private uploads, image/video publication and reuse across pages, and keyboard/accessibility checks at 390/1440 px. Picker screenshots were visually reviewed. Mutations used isolated fixtures rather than the hosted store; no physical iOS/Safari check, commit, push or deployment was performed. Git checks confirm `.env.local` remains ignored and untracked.

## Bulk collection visibility - 19 October 2026

Added Select all matching products with partial-selection feedback, Clear selection, bulk Show in collection / Hide from collection, individual Show/Hide actions and public product/collection View links. Search scopes Select all; batches are capped at 500 products. Successful changes use the existing live storefront refresh. Hiding retains saved products, sizes and inventory as drafts. Mobile search uses a full row and product actions wrap beneath their details. The selected count has sufficient contrast on the bulk toolbar.

The additive `20261019000500_product_visibility.sql` migration replaces the existing protected bulk RPC, retaining stock/archive/reorder actions. Owner/editor membership and MFA are required. Publication confirms the saved details, validates the whole selection before updating, and reports incomplete design references without partly publishing a batch. Names, descriptions, positive prices, photos, active sizes and known inventory are required; zero stock is allowed. Duplicate, missing and oversized selections are rejected. The migration itself does not alter any product visibility; hosted activation requires the user to run it once in SQL Editor. No hosted product data was changed by the agent.
