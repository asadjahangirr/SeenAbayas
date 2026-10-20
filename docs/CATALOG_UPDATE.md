# Client catalogue update — 20 October 2026

All nine designs have photographs, descriptions, confirmed prices and size labels 54, 56 and 58 prepared. The previous seven products still exist in hosted Supabase; six were private drafts, rather than deleted.

The confirmed prices are Olive/Brown/Teal/Tie Dye Blue £40; Burgundy Roselle/Cream/Polka Dot £45; Black Lace/Black Sequin £50. Only Burgundy Roselle has stock: 54 × 1, 56 × 1, 58 × 2. The other eight designs will be visible and sold out. The new full-page and product-dialog size guide uses the supplied 137/142/147 cm lengths and suggested heights.

## Apply to the hosted store

1. Commit/push these project changes and wait for Vercel to finish deploying them. This makes the new Brown and Olive image URLs available. Keep the existing Supabase catalogue/CMS sources and test-only payment configuration.
2. Finish or cancel abandoned sandbox checkouts through their original SEEN confirmation page. For expired provider sessions, use **Admin → Orders → Refresh payment statuses**; repeat if more than five need checking. Closing a tab does not cancel a checkout. Do not manually reset reservation counters.
3. In the existing Supabase project's **SQL Editor**, paste and run the entire [catalog-release-20261020.sql](../supabase/catalog-release-20261020.sql). This is a data import, not a rerun of the original schema. No new credentials or permissions are required.
4. Its final query should show **nine published products**, each with active sizes **54, 56, 58**. Burgundy Roselle quantities should be **1, 1, 2**; every other quantity should be **0**.
5. Open `/collection`: verify all nine names/prices, each product gallery, the sizing dialog and Burgundy availability. The existing public revision polling should refresh an already-open storefront within its normal interval. Existing bags revalidate against the new prices and sizes.

If SQL reports **Catalogue update stopped**, the entire transaction was rolled back because a reservation is still held. Complete/cancel or reconcile that checkout first, then run the same file again. Do not delete orders or override inventory checks to force the import through.

The import preserves product and size IDs, existing order references, private costs, categories and additional uploaded photographs. It saves a private snapshot before updating and does not delete the retired 52/60 sample-size IDs. It does not change payments, categories, homepage featured selection or other website settings. Repeating a successfully applied batch makes no changes, protecting subsequent admin edits and stock changes. Future catalogue edits should use the admin dashboard; do not rename the batch merely to force a reset.

## Source files

- `assets/catalog-release-20261020.json`: client-approved names, descriptions, prices and stock for this import. Exact quantities are not shipped in the browser bundle.
- `assets/manifest.json`: nine photo groups; original references 01–07 retained, Brown is 08 and Olive is 09.
- `assets/source/catalog-intake-20261020.json`: original-name mapping and source hashes for the seven new photos.
- `src/data/size-guide.ts`: shared client-supplied length/height guide.
- `scripts/prepare-catalog-release.mjs`: generates the SQL locally; never connects to Supabase. Run with `node scripts/prepare-catalog-release.mjs` after deliberately editing its inputs.

Fabric composition, care instructions, detailed body/garment measurements and whether accessories are included have not been supplied. Descriptions use the visible design and confirmed colour/detail names without inventing those specifications. Stock and prices can be managed through the existing admin after import. Historical local development fixtures are separate from this live catalogue update.
