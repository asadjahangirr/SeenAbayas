# Administrator permissions

The main administrator is the existing, verified owner account for **asadjahangirr9@gmail.com**. Its user ID is retained privately, so changing its verified email later does not transfer main access to someone else. Only this account can create administrators, change their assigned permissions or disable them.

## Activate

1. In the existing Supabase project → SQL Editor, run the **entire** `supabase/migrations/20261023000500_admin_permissions.sql` file, after the earlier migrations including checkout coupons `004`.
2. The final result must show **`main_admin_ready = true`**. If false, the matching verified, active owner was not found. Check that existing account in Supabase Auth and its approved membership; do not create a duplicate or change other users into owners. Resolve the account mismatch and rerun this same migration.
3. Push/deploy the updated application, then reload the admin dashboard. No new environment variables are required.
4. Sign in as the main account → **Account & access → Administrators and access**.

Installation does not create accounts, change orders, prices, payment settings or stock. Existing administrators retain their previous section permissions until you edit them. They no longer have team-management access. Apply migrations in order; do not reinstall an older account migration over this one.

## Create or change a sub-admin

Enter a unique username, administrator name and temporary password of at least 14 characters. Tick the allowed options, enter **your own current password**, then choose **Create administrator**. The new person can sign in with their username, change their password and verify their own recovery email.

For an existing person, choose **Edit access**, tick/untick permissions, confirm your password and choose **Save administrator access**. Uncheck **Allow this administrator to sign in** to disable them. Their existing session loses server/database access on its next request. Reload their dashboard (or use **Refresh workspace**) to refresh menus. The main account cannot restrict or disable itself here.

Permissions cover products, permanent deletion, categories, orders, customer inbox, finances, discounts, website wording, homepage film, media management, colours, motion, featured products, banner, delivery/parcel settings, business details, privacy, policy review and history. Product editing includes product prices, sizes, stock and visibility; it is one permission. Permanent deletion is a separate permission and also requires product editing.

**Publish assigned website changes** is separate from saving drafts. Give it to someone who should publish their assigned website settings immediately. Product/category/coupon/operational changes retain their existing save behaviour. Media management controls uploading/deleting; product, film and text editors can browse existing assets without permission to upload or delete them. Product editors can read category choices without permission to manage categories.

The sidebar, overview shortcuts and settings panels follow these assignments. Database checks also protect direct requests, sensitive customer/finance records, private product costs, storage uploads/deletion and underlying implementations. Limited staff cannot publish another person's pending changes to unassigned settings; the main account should publish those first. A full website document is used internally for safe editing, so these permissions control management actions rather than treating every unassigned draft wording field as a separate confidential document.

## Quick acceptance check after deployment

Create a temporary administrator with only **Change the announcement banner** and **Publish assigned website changes**. In a separate browser profile, verify that Store settings shows the banner controls and hides delivery/business controls, Orders is absent, and Account & access offers only that person's own account settings. Save an approved banner edit, then remove that permission from the main account and refresh the other dashboard. Delete no customer records and make no test payment for this check.

Local verification is recorded in `DEVELOPMENT_NOTES.md`. Test accounts are created only in the disposable fixture, not the client's hosted project.
