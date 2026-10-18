# Seen Abayas

A Next.js App Router storefront for the SEEN ABAYAS brand. The original client brief is preserved in [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md).

## Current checkpoint: Storefront and local Supabase catalog foundation

- White/ivory design tokens, locally hosted Inter and Cormorant Garamond, shared buttons and accessible text inputs.
- Responsive header/footer, real supplied logo, working page/anchor navigation, and a native mobile navigation dialog. Collection navigation and homepage buttons lead to `/collection`; the active navigation item is marked on that page.
- A homepage with three distinct designs in the hero, a two-line slogan, fuller brand introduction, and official brand-story excerpts.
- Desktop photo flips reveal another actual view of the same garment; click or keyboard activation can keep a view. Phones and tablets use a swipeable photo strip with paging controls and tap-to-turn photographs. Reduced motion switches views without a flip.
- A four-piece featured photo edit expands to seven photographed designs. Cards open galleries with real alternate views, thumbnails, arrow keys, touch swipes, Escape, focus containment, and focus restoration. Enquiries open email; there are no invented prices or purchasing controls.
- A dedicated `/collection` page with all seven photographed groups, colour filtering, multi-word photo search, alphabetical sorting, result counts, and an empty-result reset. Search and filters operate locally on the supplied photo captions and descriptions; these are not a Supabase catalog or confirmed commercial variants.
- Collection images and captions now link to individual `/collection/design-01` through `/collection/design-07` pages. A separate quick-view button retains the gallery workflow. Gallery dialogs also link to the matching piece page.
- Individual pages have real-photo thumbnails, arrow-key and swipe navigation, an accessible enlarged photo viewer, 2× magnification with scrolling, native sizing/delivery disclosures, email enquiries, and links to three other actual photographed designs. One-photo pieces retain enlargement without redundant navigation. Unknown IDs, including the unphotographed eighth design, return a dedicated 404.
- The enlarged viewer loads the already prepared WebP only when opened and uses that full-resolution file directly. Magnification does not trigger another optimizer request; collection cards and the normal product photograph continue to use responsive image optimization.
- Individual-page descriptions describe only visible details. Names remain photography captions, and photo colours are not commercial variant selectors. Price, size choices, stock, fabric/care specifications, a size chart, and Add to Bag are intentionally pending confirmed client data. No product offer schema or invented availability is emitted.
- Collection motion includes typography entrances, staggered viewport reveals, alternate-photo crossfades and image zoom on desktop hover, filter underlines, and shared button/navigation effects. Content remains visible without JavaScript; reduced-motion users retain functional browsing without motion.
- A slow animated delivery announcement with pause/resume controls, animated navigation labels and underlines, button fill transitions, image hover treatments, and short entrance sequences. Reduced-motion users receive a static presentation.
- CSP with fresh script nonces, baseline security headers, site URL validation, indexing disabled by default, and browser checks for responsiveness, accessibility, and security behavior.
- A Supabase-ready PostgreSQL migration for products, sizes and private inventory; read-only public grants/RLS, publication constraints, and a catalog RPC that omits exact stock. The draft seed uses only supplied photography references. No hosted project has been created or changed.
- Explicit `CATALOG_SOURCE=preview` (default) and `supabase` modes. Configured mode reads approved data on the server, displays real names/prices/size availability, handles empty and failing backends, and never falls back to preview merchandise. Missing project configuration fails clearly without exposing connection values.

All 25 supplied files have been preserved and hash-verified during relocation into `assets/source/`. Fifteen unique garment photos are grouped into seven provisional designs. Three exact duplicate copies and six unassigned videos are preserved separately. The planned eighth design is pending. Labels such as “Burgundy” describe the photography; they are not confirmed commercial product names. Product names, prices, sizes, materials, and stock remain pending client input.

Public WebP copies are auto-oriented, resized, and stripped of EXIF/XMP metadata without retouching. Sixteen images (including the logo) total approximately 2.15 MB, compared with 20.85 MB for those source files. `next/image` also serves responsive sizes. The logo's excess surrounding space is framed with CSS without changing its artwork.

Hosted Supabase setup and approved product entry remain pending. The schema and read path are prepared and tested locally; they are not a verified hosted backend. Purchasing, cart, newsletter, contact form, full story/policy pages, admin authorization, Storage uploads, payments and fulfillment remain subsequent checkpoints. Catalog filtering/search still runs locally over the server-provided public catalog. The current contact link opens an email client. No deployment has been made.

Follow [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) when creating the client-owned project. The current photo preview stays available without credentials. Privileged keys are not required for the read-only catalog.

The Collection page extends the existing editorial design rather than replacing it: white/ivory surfaces, Cormorant Garamond display type, Inter controls, and real garment photography. Design dial values are variance 7, motion 6, density 3, chosen for the requested luxury fashion direction. Animations communicate page hierarchy, reveal another garment view, or confirm browsing changes. No animation package or extra runtime dependency was introduced.

## Approved execution choices

These choices take precedence over alternatives in the original master brief:

- Next.js, TypeScript, and Tailwind CSS.
- Supabase PostgreSQL, Auth, and Storage; Prisma, Auth.js, and Cloudinary are not part of the initial architecture.
- Guest checkout, protected admin accounts, and Stripe-hosted Checkout.
- Real supplied brand imagery for the first review.
- The client's later request for an animated delivery banner and a richer multi-image hero supersedes the original brief's static banner. There is no automatic hero slideshow.
- Build and review one page or feature at a time. Integrations remain pending until their real behavior is verified.

## Development

Use Node.js 22 or later (set up with Node.js 24).

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
  components/home/            Hero lookbook and featured photo collection
  components/collection/      Collection browser and shared photo gallery
  components/product/         Product photography and enlarged viewer
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

Copy `.env.example` to `.env.local` when configuring services. The current storefront preview runs without Supabase credentials. A configured public site URL must be an HTTPS origin; HTTP is allowed only for loopback development. Invalid configured values fail clearly without printing their values.

Keep `SITE_INDEXING_ENABLED=false` until launch. Indexing requires an explicit public site URL. `noindex` is a search-engine instruction, not access control; any remotely hosted preview also needs hosting access protection.

The CSP uses a new 256-bit nonce for each document request and prohibits unapproved scripts, objects, and frames. This requires dynamic server rendering and uncached document responses. Inline styles remain allowed for Next.js image positioning; inline scripts are nonce-restricted. Development alone permits script evaluation and WebSocket connections for Next.js tooling. External images and browser API connections are blocked until a specific integration requires an allowlisted origin. Revisit and test the policy as services are added.

The catalog schema, RLS/grants and publication constraints are implemented locally. Authentication, hosted migrations, storage policies and checkout are not yet configured. Proxy/CSP is not authorization. Before introducing application writes or customer data, implement server-side admin authorization, MFA, storage permissions, input validation, shared rate limiting and the relevant abuse protections. Before checkout, implement transactional inventory reservations, authoritative money calculations, verified payment events, and recovery from retries and failures.

Supabase privileged keys bypass database access protections and must remain server-side. Secret keys must never use the `NEXT_PUBLIC_` prefix or be committed. A passing dependency audit or browser smoke suite is not a complete security review.

## Remaining client inputs

Before the commercial catalog and purchase features: genuine product names, GBP prices, variant measurements, stock, and confirmed photos mapped to each design. Before integrations: client-owned Supabase, email, Stripe, and Royal Mail configuration. Before launch: confirmed delivery/tax/promotion rules, legal trading details, return address, approved policies, domain, and hosting budget.
