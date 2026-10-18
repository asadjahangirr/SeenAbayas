# Supabase catalog setup

This phase prepares a read-only commerce catalog. No hosted project has been created or changed. The default storefront continues to use the supplied photo preview until the client-owned project and approved product data are ready.

## Connect the project

1. Open [the Supabase dashboard](https://supabase.com/dashboard) and create a project named `SEEN` in the client's organization. Save the generated database password in a password manager and wait for the project to finish provisioning. Keep the password outside this repository and chat.
2. Apply [the catalog migration](../supabase/migrations/20261018000100_catalog.sql) once using the project's SQL Editor, or the Supabase migration workflow. It runs in a transaction. Track the migration in the project when using the CLI; do not repeatedly apply the initial schema file.
3. Run [seed.sql](../supabase/seed.sql). It creates only seven private draft references for the supplied photographs, with no names, prices, sizes or stock. It can be rerun without overwriting existing details. The eighth design is not seeded because its photos have not been supplied.
4. Open the project's **Connect** panel to find its project URL and publishable key. Add both to the prepared `.env.local` file in this project's root, keeping `CATALOG_SOURCE=preview`. If that local file is missing on another machine, copy `.env.example` first. Secret keys and legacy service-role keys are rejected by the catalog configuration. This read-only phase does not need privileged keys.
5. Run `npm run check:catalog`. A correctly configured new project should report zero published records. This command performs a read; it never changes the database or logs connection values.

The schema `seen_private` must remain outside the Data API's exposed schemas. Browser database roles have no access to it. The public RPC `get_storefront_catalog` returns only confirmed product data and size availability; exact stock and reserved quantities are excluded.

The Data API must be enabled for the public catalog function to be reachable. If you disabled it during project creation, check **Integrations > Data API** in the dashboard. Keep `seen_private` unexposed.

For the first setup, the `.env.local` fields to fill are:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
```

Replace both placeholder values together. Leave the other settings as prepared and do not paste a database password, secret key or service-role key into either field. You can simply report "project created and local values added" once done; no credentials need to be sent in chat.

## Prepare and publish real products

The seven design references map to the photos described in [assets/README.md](../assets/README.md). Their UUIDs are internal identifiers; their public routes retain the stable design references.

Use [the product-details form](PRODUCT_DETAILS.md) to collect approved information. One complete product is enough for the first hosted verification; the other designs can remain private drafts.

Names and opening GBP prices have now been selected at the developer's request. After running the seed, apply [catalog-drafts.sql](../supabase/catalog-drafts.sql) in the SQL Editor to fill missing names/prices on unconfirmed drafts. It preserves existing values and skips published, archived and confirmed records. Its final query should show seven draft rows. It does not create sizes, stock, descriptions or published products, and the application has not applied it remotely.

Populate the following from client-confirmed information, while each product remains a draft:

- `products`: official name, description, integer GBP price in pence, ordering, and confirmation status.
- `product_variants`: actual size labels and any real SKU values. There are no guessed sizes or default stock amounts.
- `seen_private.inventory`: actual stock for each active size. A missing row means unknown stock; a row containing zero means confirmed zero stock. The `reserved` field is zero for a new stock record and cannot exceed `on_hand`.

Set `status='published'` only after the details are confirmed. PostgreSQL rejects publication without the required fields, active sizes, and recorded stock for every active size. Deferred constraints permit the product, sizes and stock to be imported atomically in one transaction. They also stop later inventory or size mutations from leaving a published product incomplete. Archive a product before removing its required catalog data.

Read availability is not an inventory reservation and never authorizes checkout. Transactional reservations, pricing revalidation, payment events, orders and admin authorization remain later phases. The current application intentionally has no Add to Bag action.

## Activate the database-backed storefront

After approved products, sizes and stock are present, set `CATALOG_SOURCE=supabase` and restart the app. The homepage edit, Collection page, product pages and their metadata read the approved catalog on the server. Existing local photos supply the imagery. Configured mode never falls back to preview merchandise on errors or when there are zero published products.

Confirmed names, descriptions, GBP prices and size availability appear automatically. Draft and archived products do not appear. Records without a supplied photography mapping are not displayed. Empty catalogs have a preparation message; a failed or invalid response produces a retry screen without internal database errors.

There is no browser connection to Supabase in this phase, so the browser CSP does not need a new connection allowlist. The server uses the publishable key with no persisted sign-in session. Reads are uncached between requests and deduplicated within a server render. A failed read times out after eight seconds.

## Verify

```text
npm run test:catalog
npm run build
npm run test:catalog-ui
npm run test:foundation
```

`test:catalog` executes the actual migration, seed, database constraints and role-based access tests in an in-memory PostgreSQL engine (PGlite). It also validates configuration, the read contract and the installed Supabase SDK's RPC request. It needs no Docker service or Supabase account.

`test:catalog-ui` runs the production app in configured mode against a local HTTP test fixture on ports 3101/3102. All synthetic names, sizes and prices are explicitly marked TEST ONLY and remain in `tests/`; none are included in the real seed or storefront preview. These checks cover actual price/size rendering, empty catalogs, failed/invalid reads, error recovery and mobile accessibility. They do not emulate or verify hosted Supabase authentication, gateway permissions or Storage.

Run `check:catalog` and verify the project access rules after applying the migration to the real project. Hosted verification remains pending until that project exists. Admin sign-in/MFA, writes, Storage uploads, cart, checkout and payment processing are not implemented in this phase.

Implementation references: [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [RPC client](https://supabase.com/docs/reference/javascript/rpc), and [PGlite](https://pglite.dev/docs/).
