# Seen Abayas

A Next.js App Router storefront for the SEEN ABAYAS brand. The original client brief is preserved in [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

Current working decisions, including the requested temporary sizes/stock and implemented admin dashboard, are recorded in [docs/DEVELOPMENT_NOTES.md](docs/DEVELOPMENT_NOTES.md).

## Current checkpoint: Storefront, shopping bag, admin and policy drafts

- White/ivory design tokens, locally hosted Inter and Cormorant Garamond, shared buttons and accessible text inputs.
- Responsive header/footer, real supplied logo, working page/anchor navigation, and a native mobile navigation dialog. Collection navigation and homepage buttons lead to `/collection`; the active navigation item is marked on that page.
- Dedicated `/our-story`, `/contact`, `/size-guide` and `/faqs` pages. Story preserves the official copy and real photographs; the size reference converts temporary inch labels accurately without claiming confirmed garment measurements. Product pages offer a native size-guide dialog. Footer/mobile links expose the help pages while desktop navigation retains four links.
- Contact includes all four required fields, client/server validation, a Resend delivery adapter and server-verified Turnstile protection. Sending remains disabled until real email/bot-protection settings are configured. Setup and verification requirements are in [docs/CONTACT_SETUP.md](docs/CONTACT_SETUP.md); no live email has been sent by the agent.
- Shipping, Returns, Privacy, Terms and Cookie pages are implemented as clearly marked, unindexed drafts. The official returns copy is preserved, with an optional cancellation-form download. Actual delivery rates/times and legal business details remain unconfirmed in validated settings. The footer/mobile links, delivery banner and contact privacy link reach the pages. Cookie controls can clear the saved bag while preserving unrelated storage. See [docs/BUSINESS_SETUP.md](docs/BUSINESS_SETUP.md).
- A permanent film-led homepage with a left-aligned slogan/collection link and the supplied emblem-plus-SEEN logo moving into the navbar. The transparent video navbar restores its white surface when the logo docks. The previous photographic hero and comparison switch are removed.
- The homepage keeps a curated four-piece edit with direct product links and a single link to the full Collection. There is no expand/collapse control or quick-view popup. The Collection is a separate shopping catalogue with a compact heading, no introductory hero images, and all available products with search/filter/sort controls.
- A dedicated `/collection` page with all seven photographed groups, colour filtering, partial name/colour/detail search, alphabetical A–Z/Z–A sorting, result counts, and an empty-result reset. Search also recognizes red for Burgundy. It operates on the catalogue supplied by the configured source.
- Collection images and captions link directly to individual `/collection/design-01` through `/collection/design-07` pages. There are no quick-view controls or photograph modals.
- Product photographs magnify in place on desktop hover, following the pointer. Touch users can tap to magnify, drag to inspect, tap to return and swipe between normal views. Keyboard users toggle detail with Enter, pan with arrows and return with Escape. Thumbnails, native sizing/delivery disclosures and related product links remain. One-photo pieces omit redundant navigation. Unknown IDs return a dedicated 404.
- Product-page photos use the prepared full-resolution WebP directly for sharp detail without another magnification request. Collection cards retain responsive image optimization. Reduced motion keeps magnification functional without animated transitions.
- Every product page has a visible Add to Bag control. Preview pieces show an explanation and a disabled button while size availability is unconfirmed; published products show actual sizes and server-checked additions. Customer care is a secondary link labelled "Ask about sizing or availability", which opens email. Preview descriptions describe only visible details; no sizes or stock are fabricated.
- Collection motion includes typography entrances, staggered viewport reveals, alternate-photo crossfades and image zoom on desktop hover, filter underlines, and shared button/navigation effects. Content remains visible without JavaScript; reduced-motion users retain functional browsing without motion.
- A slow animated delivery announcement without a pause button, animated navigation labels and underlines, button fill transitions, image hover treatments, and short entrance sequences. Reduced-motion users receive a static presentation.
- CSP with fresh script nonces, baseline security headers, site URL validation, indexing disabled by default, and browser checks for responsiveness, accessibility, and security behavior.
- A Supabase PostgreSQL migration for products, sizes and private inventory; read-only public grants/RLS, publication constraints, and a catalog RPC that omits exact stock. The hosted catalog read has been verified. The developer reports importing the seven named/priced drafts; actual sizes/stock and publication remain pending.
- Explicit catalogue modes: `preview` shows photographs without purchasing; `development` enables the requested sample sizes and stock with a visible notice; `supabase` reads published database products. Supabase mode handles empty and failing backends and never falls back to sample merchandise. Missing project configuration fails clearly without exposing connection values.
- A fine-line bag icon with an animated live quantity badge, accessible drawer and responsive `/bag` page. Shoppers can select available sizes, add/merge pieces, change quantities and remove them. The bag persists only IDs/quantities, revalidates server prices and availability, handles stale selections and synchronizes tabs. Empty states, quantity limits, strict delivery-threshold messaging, keyboard focus restoration and reduced motion are supported. A new read-only bag RPC migration needs to be applied to the hosted project; checkout/payments remain later work.

All 25 supplied files have been preserved and hash-verified during relocation into `assets/source/`. Fifteen unique garment photos are grouped into seven provisional designs. Three exact duplicate copies and six unassigned videos are preserved separately. The planned eighth design is pending. Labels such as “Burgundy” still describe preview photography. Names and opening GBP prices have been selected at the developer's request in `supabase/catalog-drafts.sql`; actual sizes, materials, descriptions and stock remain pending client input.

Public WebP copies are auto-oriented, resized, and stripped of EXIF/XMP metadata without retouching. Sixteen images (including the logo) total approximately 2.15 MB, compared with 20.85 MB for those source files. `next/image` also serves responsive sizes. The logo's excess surrounding space is framed with CSS without changing its artwork.

The local development catalogue supports bag additions with temporary length options 52–60 inches and five sample units per length. The hosted catalog connection also works; apply `20261018000200_bag_availability.sql` and complete actual product details before activating real Supabase inventory. Admin authorization and private Storage uploads are implemented; their new migrations and owner account need activation using [ADMIN_SETUP.md](docs/ADMIN_SETUP.md). Local tests do not prove hosted provider readiness. Contact service activation, newsletter, policy finalisation, payments and fulfillment remain subsequent checkpoints. No deployment has been made.

Follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) when creating the client-owned project. The current photo preview stays available without credentials. Privileged keys are not required for the read-only catalog.

The Collection page extends the existing editorial design rather than replacing it: white/ivory surfaces, Cormorant Garamond display type, Inter controls, and real garment photography. Design dial values are variance 7, motion 6, density 3, chosen for the requested luxury fashion direction. Animations communicate page hierarchy, reveal another garment view, or confirm browsing changes. No animation package or extra runtime dependency was introduced.

## Approved execution choices

These choices take precedence over alternatives in the original master brief:

- Next.js, TypeScript, and Tailwind CSS.
- Supabase PostgreSQL, Auth, and Storage; Prisma, Auth.js, and Cloudinary are not part of the initial architecture.
- Guest checkout, protected admin accounts, and Stripe-hosted Checkout.
- Real supplied brand imagery for the first review.
- The client's later requests supersede the original static banner and hero: the delivery announcement is animated without a pause button, and the homepage uses the supplied muted, looping campaign film as its permanent design.
- Build and review one page or feature at a time. Integrations remain pending until their real behavior is verified.

## Development

Use Node.js 24.x. The package and lockfile pin the major version so Vercel keeps Node 24 security/patch updates without automatically moving to a future major. Vercel's project setting can also be set to Node.js 24.x under Settings → Build and Deployment.

If Vercel reports npm's `Unknown env config "cache-dir"`, check its Environment Variables for `NPM_CONFIG_CACHE_DIR` or `npm_config_cache_dir`. Remove that obsolete setting if present; npm's supported cache-path setting is `NPM_CONFIG_CACHE`. No `cache-dir` configuration is defined in this repository. If neither variable is configured in the project, the warning comes from the surrounding build environment and does not indicate an application build failure.

```text
npm install
npm run dev
```

Open http://localhost:3000. Windows PowerShell may require `npm.cmd` instead of `npm` because of script execution policy.

```text
npm run typecheck
npm run build
npm run test:foundation
npm run test:catalog
npm run test:catalog-ui
npm run test:development-ui
npm run test:contact-ui
npm run check:bag
```

Browser tests start and stop a production server on port 3100; build first. Tests use the installed Microsoft Edge on Windows. Set `PLAYWRIGHT_CHANNEL=chrome` to use an installed Chrome instead. Other platforms default to Playwright Chromium and require its browser installation. Playwright reports and screenshots are ignored by Git.

The separate catalog database suite needs no browser or hosted services. The configured-mode browser suite uses only a local test fixture on ports 3101/3102 and never writes to Supabase.

## Media and component structure

```text
assets/
  incoming/                   Future uploads and intake instructions
  manifest.json               Photo-to-design mapping and captions
  media-inventory.json        Source hashes and prepared-image dimensions
  source/
    brand/                    Original supplied logo
    products/design-01…07/    Unchanged source photos
    duplicates/               Preserved exact duplicate copies
    videos/unassigned/        Original videos awaiting confirmed mapping
    relocation-inventory.json Original filename, destination, and SHA-256
public/images/
  brand/logo.webp
  products/design-01…07/      Prepared public image copies only
src/
  app/collection/             Collection route, metadata, and scoped styles
  app/collection/[id]/        Individual piece pages, metadata, styles, and 404
  components/home/            Permanent film hero and featured product collection
  components/collection/      Collection browser and product links
  components/product/         Product photography, inline magnification and purchase controls
  components/ui/              Shared controls
  data/collection.ts          Typed photography data
  data/media.generated.json  Generated public photo paths and captions
  lib/dialog-focus.ts         Shared keyboard focus handling
  lib/catalog/               Configuration, RPC types, validation, server reads
supabase/
  migrations/                Transactional catalog schema and access rules
  seed.sql                   Seven private photo references, no guessed data
```

After confirming new photo mappings, edit `assets/manifest.json` and run `npm run prepare:media`. This validates the manifest, prepares public images, and regenerates data and the media inventory. Keep originals outside `public/`; only prepared images are served by the storefront. See [assets/README.md](assets/README.md).

## Environment and security

The homepage always uses the selected film at `/`, without a preview flag or photo alternative. The video and poster are project assets at `public/videos/home/hero.mp4` and `public/images/home/hero-poster.webp`, ready to be committed with the site. Preparation and playback behaviour are documented in [HERO.md](docs/HERO.md). A still poster handles loading, reduced-motion/data-saving preferences and autoplay/video failures.

Copy `.env.example` to `.env.local` when configuring services. The current storefront preview runs without Supabase credentials. A configured public site URL must be an HTTPS origin; HTTP is allowed only for loopback development. Invalid configured values fail clearly without printing their values.

Keep `SITE_INDEXING_ENABLED=false` until launch. Indexing requires an explicit public site URL. `noindex` is a search-engine instruction, not access control; any remotely hosted preview also needs hosting access protection.

The CSP uses a new 256-bit nonce for each document request and prohibits unapproved scripts, objects, and frames. This requires dynamic server rendering and uncached document responses. Inline styles remain allowed for Next.js image positioning; inline scripts are nonce-restricted. Development alone permits script evaluation and WebSocket connections for Next.js tooling. External images and browser API connections are blocked until a specific integration requires an allowlisted origin. Revisit and test the policy as services are added.

The catalog schema, RLS/grants and publication constraints are implemented and the hosted catalog read has passed. The bag/admin/media migrations remain manual hosted setup steps. Invite-only administration, server/database role checks, mandatory MFA, private media permissions and draft publication are implemented; activate them using [ADMIN_SETUP.md](docs/ADMIN_SETUP.md). Proxy/CSP supplements these permissions. Shared hosting/WAF rate limits and provider configuration are still required before launch. Bag inputs and money are server-validated; before checkout, implement transactional inventory reservations, verified payment events, and recovery from retries and failures.

Supabase privileged keys bypass database access protections and must remain server-side. Secret keys must never use the `NEXT_PUBLIC_` prefix or be committed. A passing dependency audit or browser smoke suite is not a complete security review.

## Remaining client inputs

Before activating the commercial catalog: confirmed descriptions, actual sizes/measurements, stock and photo groupings. Names and opening prices are already selected. Before integrations: client ownership/billing handoff, email, Stripe and Royal Mail configuration. Before launch: confirmed delivery/tax/promotion rules, legal trading details, return address, approved policies, domain and hosting budget.

## Administration

Visit `/admin` after following [ADMIN_SETUP.md](docs/ADMIN_SETUP.md). The workspace manages products, sizes/stock, categories, orders, inbox, expenses, coupons, video clips/poster, media, website copy, appearance/GSAP presets, store/policy settings and revision history. See [the reference adaptation](docs/ADMIN_REFERENCE.md) for the reviewed previous repository and intentional differences.

Use **Save & show in store** for visible products and **Save & update store** for website changes. Money inputs use pounds; storage uses integer pence. Categories appear even before products are assigned. With the sync migration installed and both sources set to Supabase, active store tabs check the public revision every two seconds and refresh changed content automatically. Each admin section includes short usage instructions and connection diagnostics. Drafts remain private.

`CMS_SOURCE=files` preserves the checked-in website; `CMS_SOURCE=supabase` reads published content. `CATALOG_SOURCE` independently selects the product source. No hosted account or database changes are made automatically. Admin browser checks use `npm run test:admin-ui` and an isolated local provider/database fixture; normal database checks use `npm run test:catalog`. Regenerate the copy editor registry with `npm run prepare:copy` after adding editable storefront copy.

`npm run test:mobile-ui` checks Android touch shopping, video playback/recovery, gallery and size-guide controls, network retries, older browser compatibility and customer-page layouts. Bag, live-sync and contact requests use compatible AbortController deadlines; bag quote reads run concurrently. Out-of-stock sizes remain unavailable: enter actual stock, or the approved temporary test quantities, in Products & stock before testing Add to Bag on the live catalogue.
