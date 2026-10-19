# Reference adaptation

Inspected `https://github.com/asadjahangirr/pd` at commit `6376a8970ff970f7cc73a2de0005d848db23828b`. The ignored `.reference/pd` checkout is for source inspection only; no scripts or dependencies from it were executed.

Reviewed `client/src/components/AdminLayout.jsx`, the admin API module, every `Admin*.jsx` screen and the server models/routes for products, categories, orders, messages, expenses, coupons, site content and theme.

The previous project uses React/Vite, Express and MongoDB. SEEN implements the same management areas in Next.js/Supabase rather than copying its storage or authentication scheme:

- Dashboard: catalog, stock, publishing and recorded order/payment overview.
- Products: add/edit, photography upload/selection, sizes/SKUs, private costs, category, stock, bulk stock/archive and ordering. Archive preserves product history instead of permanent deletion.
- Product removal now also supports owner-only permanent deletion of unused products after confirmation; order-linked/reserved products retain the archive workflow. Uploaded files remain reusable.
- Collection visibility: select individual/matching products and show or hide them in one atomic batch, with clear incomplete-product errors. Rows expose Show/Hide and public View links without opening the editor.
- Categories: add/edit/remove with assigned-product protection.
- Store synchronization: all saved categories, including empty ones, appear in collection navigation. Active storefront sessions detect public revisions; sample/file mode and pending migrations are identified in the admin.
- Orders: search, filters, details, status, tracking, notes and CSV export. Financial records are retained; provider-controlled payment state cannot be edited.
- Inbox: read/archive/delete and email reply link; verified contact ingestion is an optional server integration.
- Finance: GBP expenses and payment-based summaries. No invented courier cost or assumed accounting profit.
- Coupons: percent/fixed, minimum, active, expiry and usage limit; redemption waits for checkout.
- Hero: ordered video clips, poster and internal button destination adapted to the chosen permanent video design; button wording is editable in Website text.
- Site images: private media library plus image replacements across the storefront and product-specific gallery management.
- Reusable media: shared visual picker, computer uploads and configurable image/video sections before or after any customer page, including individual product pages.
- Site text: searchable registry across customer pages and components, including defaults, resets and static metadata.
- Appearance: palette, featured pieces and additional selectable GSAP motion/hover presets.
- Settings: announcement, shipping offer, business/delivery/privacy fields and secured account password changes.

Added explicit draft publication, previews across customer routes, revision restoration, concurrent-edit protection (including stock changes), owner/editor permissions, mandatory MFA and activity logging. Account controls include confirmed login-email changes, password changes and PKCE password recovery with MFA. Administrator membership and lost-authenticator recovery remain project-owner operations. Credentials and email transport are never made editable as public content.

See `ADMIN_SETUP.md` for activation, integration boundaries and current data-volume limits.
