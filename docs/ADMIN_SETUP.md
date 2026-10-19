# SEEN administration

The admin lives at `/admin`. It uses Supabase Auth, invite-only database membership and mandatory TOTP authentication. There is no default admin account or public registration. Existing storefront content remains active while `CMS_SOURCE=files`.

## Enable your workspace

1. In the **same Supabase project** already connected to SEEN, open SQL Editor. The catalog migration must already be installed. If it is installed, do not rerun it: `relation products already exists` means it already created that table.
2. Run `20261018000200_bag_availability.sql` if you have not installed it yet. Then run these administration migrations, in order. Skip previously installed admin/media migrations:
   - `supabase/migrations/20261019000100_admin.sql`
   - `supabase/migrations/20261019000200_admin_media.sql`
   - `supabase/migrations/20261019000300_storefront_sync.sql` (safe to rerun; includes empty categories and the public change token)
   - `supabase/migrations/20261019000400_product_delete.sql` (safe to rerun; installs owner-only deletion without deleting existing data)
   - `supabase/migrations/20261019000500_product_visibility.sql` (safe to rerun; enables bulk Show/Hide without changing existing visibility during installation)
3. In Authentication → Users, create your own Auth user and set a password of at least 14 characters there. Use an email address you control. Disable public sign-ups in your project's Auth settings; admin membership still requires the separate grant below.
4. Copy `supabase/bootstrap-admin.sql` into SQL Editor, replace its example email **in the editor** with that Auth user's email, then run it. This grants that specific user owner access. Keep the checked-in example unchanged. Never put a password or secret key in the SQL file.
5. Open `/admin/login`, enter your email/password, then enrol an authenticator app and verify its current six-digit code. Subsequent sign-ins require that authenticator.
6. In `.env.local`, set `CMS_SOURCE=supabase` and restart Next.js. Website text/media/settings now come from the **published** CMS document. Saving a draft alone does not change the public website.
7. Review Products & stock. Existing catalog seed records remain private drafts. Edit their names, GBP prices, descriptions, photos and sizes, choose **Visible in store**, then **Save & show in store**. That action confirms and publishes the details you entered. New products default to visible; choose Hidden draft if they are not ready. Upload photographs directly in the product form or choose existing images.
8. When ready to use database products, set `CATALOG_SOURCE=supabase` and restart. With `CATALOG_SOURCE=development`, the shop still uses the temporary sample catalog, so admin product changes will only appear in draft preview. Keep indexing disabled and checkout closed while data is temporary.

You do **not** need a service-role/secret key for admin sign-in, content, inventory or media management. Keep the URL and publishable key already configured. No hosted migrations, accounts or membership grants have been applied automatically.

## Daily editing

Each admin page has **How to use this page** with short instructions. The connection panel identifies sample/file mode, missing migrations and connection errors instead of implying that every save is already live. All money fields accept pounds, such as `85.99`; the database still stores integer pence.

- **Website text:** search by phrase or filter by page/component. Headings, paragraphs, navigation labels, forms, policy copy, image descriptions and static page metadata retain their original defaults until overridden. Repeated matching text is shared. Reset restores the original. New developer-written copy can be registered with `npm run prepare:copy`.
- **Apply website changes:** use **Save & update store** to publish text, images, video, appearance or settings in one action. For private review, use **Save draft → Preview draft → Save & update store**. The preview supports customer pages and saved unpublished product records; shopping is disabled. Unsaved browser edits are not part of preview. Stale updates are rejected instead of overwriting another administrator's changes.
- **Products:** Add product is at the top of Products & stock; Add another product is also available beside search. Create/edit GBP prices, private cost, descriptions, colour, category, image ordering/alt text, size/SKU/active status and stock. Empty, unconfirmed records for the seven existing designs can use the current temporary catalog defaults in the editor; these are not approved commercial facts and are not saved until you explicitly save the form. Bulk stock changes, bulk archive and ordering are supported. On-hand stock cannot fall below reserved stock, and inventory changes invalidate old product forms. Retired sizes retain their history. Owners have a Delete button on each row. After confirmation it permanently removes an unused product, its variants and inventory; stale forms, reserved stock and order references block deletion. Uploaded files stay in the reusable library. Ordered/reserved products must be archived instead.
- **Categories:** create/edit/delete. The slug fills automatically from the name. Saved categories appear in the collection's Category menu even before products are assigned. Assign each product in Products & stock. Move products out of a category before deleting it. Successful forms close/reset; failed saves retain the entered details.
- **Hero video:** retain the full-screen video and scroll-docking SEEN logo. Select/reorder up to eight MP4 clips; clips play in sequence. Select the fallback poster and edit the collection button's internal destination. Edit its wording in Website text. Muted mobile playback, offscreen pausing, reduced-motion/data-saving poster fallback and transparent-to-white navigation remain in place.
- **Media:** upload JPG/PNG/WebP/MP4 from your computer, up to 25 MB each and 20 files at a time, directly to the private `seen-media` bucket. Browse buttons open a searchable visual picker with Upload from computer, so you can upload/select without leaving a product or hero form. The same uploaded file can be reused in several compatible slots. Immutable filenames avoid overwrite races. Only media referenced by current published content or published products can be read publicly. SVG uploads are disabled. Replacement brand logos should be tightly cropped transparent PNG/WebP silhouettes suitable for a CSS mask. Files referenced by drafts, products or the retained publication history cannot be deleted.
- **Appearance:** ink/paper/accent, featured pieces, GSAP subtle/editorial/cinematic scroll reveals and lift/magnetic/sheen hover presets. The homepage selector offers published products; remove a selection to make room when four are chosen. Hide homepage edit removes that section. Product ordering arrows control related recommendations; the collection retains its requested alphabetical sorting. Touch and reduced-motion behaviour are preserved.
- **Settings:** delivery announcement, banner colours/speed, free-delivery offer/threshold, future checkout minimum, business identity, postal/returns addresses, delivery charges/aims, legal review and privacy disclosures. The threshold updates the banner, bag progress and delivery wording independently of product prices. Unconfirmed fields stay blank and policies remain drafts until all required information is complete. The customer care email is editable by an owner in Website text by searching `info@seenabayas.co.uk`; it updates contact links and the configured contact form recipient.
- **History:** the last 30 published content revisions can be restored into a new draft. The latest 100 catalog, content and operational-record mutations are listed without message bodies, passwords or API keys.
- **Account:** change your password with your current password and a fresh authenticator code; successful changes sign out all sessions. Login email changes require the current password, fresh MFA and Supabase email confirmation. Forgotten passwords use a PKCE recovery link plus a fresh authenticator code; open the link in the browser that requested it. Adding/removing administrator membership and lost-authenticator recovery remain project-owner operations. Editors can manage catalog and presentation; financial/customer data and business settings require an owner.

## Put your own image or video on a page

1. Open Media library and upload files from your computer, or choose **Add image or video section → Upload from computer**. One file upload in the picker selects it immediately; with multiple uploads, choose the file you want afterward.
2. **Use on a page** adds a section below. Choose Home, Collection, Our Story, Contact, a help/policy page, Shopping Bag, Every product page or one specific product.
3. Choose before/after page content, natural/landscape/portrait/square framing, an accessible description, an optional caption and, for video, an optional poster. Uploaded page videos use native playback controls and do not autoplay. Provide an equivalent caption/transcript for spoken content.
4. Add more sections, reorder them or reuse the same file on other pages. Up to 24 sections are supported. Save draft previews them privately; **Save & update store** publishes them. Remove section removes its placement, not the uploaded file. A section targeting a deleted product can be retargeted or removed here.

Image-only slots (logos, product photos and posters) accept images; hero video slots accept MP4. Flexible page sections accept either. Reusing a file does not make an image slot into a video player. Files can be uploaded once and selected wherever that format is supported.

## Live updates and missing products

To show several saved products at once, open **Products & stock**, tick their checkboxes (or **Select all matching products**), then **Show in collection**. Search first to select a matching group; Clear selection resets the checkboxes. **Hide from collection** keeps products and stock saved as hidden drafts. Each row also offers Show/Hide without opening Edit, and visible rows have View links to the public product page. View collection opens the public listing in a new tab. Batches support up to 500 products.

Show in collection confirms the saved details for the whole selection. Every selected product needs a saved name, description, positive price, photograph, active size and known inventory; zero stock is allowed. If any are incomplete, the error lists their design references and none of the selected products is newly published. Complete those missing details or exclude them, then retry. This action does not invent product information or save unsaved editor fields. If the dashboard names `20261019000500_product_visibility.sql`, apply that migration once in SQL Editor.

With both source settings on Supabase, saving visible products, stock or categories applies directly. **Save & update store** publishes website content immediately. Open store tabs receive a same-browser update signal and independently check the public revision every two seconds while visible/online, so other devices also refresh without a manual reload. Full page data is fetched only when a revision changes; scroll position and collection filters are preserved. Hidden/offline tabs pause and catch up on focus or reconnection. Failed checks back off and retry. This is fast polling with same-browser notifications, not a Supabase Realtime subscription; network/server latency still applies.

If a product is missing, check these in order:

1. The connection panel must show Supabase for products and content. Sample/file mode reads different data; restart after changing `.env.local` or hosting variables.
2. Choose **Visible in store**, then **Save & show in store**. A saved hidden draft is deliberately private. Name, description, a positive price, a photograph and an active size are required. Zero stock is allowed but unavailable to buy.
3. Check `/collection` with search/filters cleared. The homepage edit shows only its selected pieces; a newly added product does not automatically replace those selections.
4. Assign the product to its category in the product editor. An empty category remains visible in the menu, with no matching pieces until assigned.
5. If the panel names the sync migration, run only `20261019000300_storefront_sync.sql`. Older installations retain published-product/content refresh through a compatibility read, but empty categories need this migration.

The public sync endpoint returns only an opaque revision. Category reads expose name, slug and description; financial records, draft content, exact stock and customer data remain private. No service-role key or browser database subscription is needed.

## Auth email setup

In Supabase Auth's URL configuration, set your site origin and allow the callback URL for each environment you use, including its email-change variant. For example:

```text
http://localhost:3000/admin/auth/callback
http://localhost:3000/admin/auth/callback?intent=email
https://www.seenabayas.co.uk/admin/auth/callback
https://www.seenabayas.co.uk/admin/auth/callback?intent=email
```

Configure Supabase Auth email delivery for recovery and confirmation emails. This is separate from the website's contact-form Resend configuration. The initial owner can be created with a password in the dashboard; there is no public signup. Password recovery does not bypass MFA. If the authenticator is lost too, the project owner must verify the person's identity and use Supabase Auth's administrative recovery controls. [Supabase password and recovery guide](https://supabase.com/docs/guides/auth/passwords?flow=pkce&queryGroups=flow).

## Orders, finance, coupons and inbox

The reference project's operational sections have matching management tools here, with GBP and SEEN's data model:

- Orders: customer/item details, search/status filters, fulfilment status, tracking references, internal notes and CSV export. Payment state is integration-controlled. Unverified orders cannot be fulfilled, closed orders cannot be reopened, and order history cannot be deleted. Cancelling fulfilment does not execute a payment cancellation or refund.
- Finance: verified net payments received, recorded expenses, cash after recorded expenses, editable dated expense records and notes. This is not an accounting profit calculation; stock costs, VAT and unrecorded costs are excluded.
- Coupons: create/edit/delete, percentage or fixed-pound discounts, minimum subtotal, active/expiry and usage limit. Values remain integer pence in storage. The future checkout must enforce redemption and limits atomically; saving a code does not enable checkout.
- Inbox: read/unread, archive/unarchive, customer contact details, email reply link and deletion. Messages are copied only after Turnstile validation and successful provider acceptance. To enable this, configure Resend/Turnstile as in `CONTACT_SETUP.md`, add `SUPABASE_SECRET_KEY` **server-side only**, set `CONTACT_INBOX_ENABLED=true`, and restart. Never prefix that key with `NEXT_PUBLIC_`, commit it, or send it in chat. The normal email flow works without the optional inbox copy. If inbox storage fails after email acceptance, the form reports failure; retries use the same request ID/provider idempotency key.

Checkout, payment webhooks/refunds, stock reservation for orders, courier label purchasing and automated dispatch emails are still separate integrations. Orders are created only by a future trusted checkout/payment integration, not by an editable browser payload. Royal Mail tracking entry is available; no Royal Mail account is connected. Operational lists/search/CSV currently load the latest 1,000 combined records and 100 audit events; add list pagination before the business exceeds that volume. Financial totals and order counts are computed across all records independently of the list limit. Provider secrets remain in hosting settings.

## Before deployment

Use the client's project ownership/billing, actual HTTPS site origin, verified auth/email sending configuration and strong passwords. Configure Supabase Auth rate limits and hosting/WAF limits for `/api/admin/auth` and `/api/contact`. Test a real invite, MFA enrolment/login/recovery, private upload and publication in your hosted project. Local provider fixtures exercise the UI, while database tests exercise the actual migrations with simulated Auth/Storage schemas; they do not certify hosted provider configuration.

Official references: [Supabase server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).
