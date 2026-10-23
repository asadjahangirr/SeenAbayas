# Fast, straightforward store management

Updated 23 October 2026. This update improves the existing admin; it does not replace the store, catalogue, payments or customer design.

## Install in this order

1. In the existing Supabase SQL Editor, run `supabase/migrations/20261023000100_shipping_read_compatibility.sql` if not already applied. It fixes older deployed storefronts rejecting the new shipping field in fixed mode. It changes only the public content reader.
2. Run the complete **`supabase/migrations/20261023000200_admin_workspace.sql`**. Expected: **Success. No rows returned.** This installs the requested password-only membership policy, private usernames, email-verification receipts and shared account limits. Existing owners/editors remain approved. It does not create an account, set a password, send an email or change orders/stock/prices. Both files are rerunnable.
3. Confirm Vercel Production already has `SUPABASE_SECRET_KEY`, `RESEND_API_KEY` and `ORDER_FROM_EMAIL`. These are the same private settings used for existing trusted backend operations and verified order emails. Do not prefix secrets with NEXT_PUBLIC or paste them into chat/Git. No new production variable is required; never set ADMIN_EMAIL_FIXTURE_ORIGIN in production.
4. Push and deploy the updated code. Local `.env.local` edits do not configure Vercel. Wait for Ready, then reload `/admin/login`.
5. Sign in using your existing approved owner's email and password. The new account policy removes the mandatory authenticator challenge. After a successful fresh password login, the server removes that user's old enrolled factors and refreshes their session. Other permissions and private data checks remain. Ordinary customers still cannot access administration.

Apply the new SQL **before** deploying the new login code; otherwise username lookup/shared account checks are not installed. Do not rerun the initial catalogue/admin creation scripts or delete existing users to fix a missing update.

## Create the client account

1. Sign in as your existing owner and open **Account & access**.
2. Expand **Add an administrator**. The username is prefilled as **seenabaya**; set the display name as desired.
3. Select **Store owner** for a client who should manage orders, finance and store settings. Website editor is limited to presentation/catalogue work.
4. Enter the temporary password privately in the form, then your own current password to approve creation. No default password is included in the source code, SQL or this guide.
5. Click **Create administrator**. Only a successful response means the hosted account exists. Duplicate usernames fail without leaving an approved duplicate account.
6. The client signs in with **seenabaya** and that temporary password. They can change their password under Account & access.
7. They add their own email below, enter their current password and click **Send verification email**. The address changes only after they open the message and click **Confirm my email**. Their username stays the same.

A provisional internal sign-in address is kept privately until a real email is verified; it is not displayed as the client's email and cannot receive recovery mail. Before an email is added, forgotten-password recovery requires owner assistance. Do not claim an unknown address can receive a reset email.

The agent has not created the production seenabaya account or saved the password from chat. Provisioning is an owner action after this migration/deployment; do not confuse the isolated test account with a real login.

## Password and email recovery

**Change password:** Account & access > Change your password. Enter current password, new password and matching confirmation. The new password needs at least 14 characters. Success signs out the user's sessions; sign in again with the new password.

**Forgot password:** `/admin/recover` accepts an email or username. If an active approved administrator has a real email, the existing verified Resend sender delivers a reset link. Public responses do not reveal whether an account/address exists. The client clicks **Open password reset**, chooses a new password and signs in again. No authenticator code is required. These messages use the existing Resend connection directly; they do not depend on Supabase SMTP being configured.

Email links do not consume their token on the landing-page GET, helping avoid email scanners spending a link before its recipient clicks. Verification and recovery links are single-use. Email changes require current-password approval before sending and proof of ownership of the new mailbox. Password recovery verifies the provider's recovery token and sets a short-lived HttpOnly proof bound to that authenticated user/session. A normal signed-in session cannot use the recovery endpoint to skip the current-password check. Raw tokens and passwords are not stored in browser local storage or application logs.

Confirmation/reset pages use no-referrer and private/no-store responses. Account endpoints validate request origin and use shared hashed quotas. Owner/editor roles, private storage and protected payment/order operations remain enforced. Mandatory MFA was removed at the operator's explicit request; this is not a claim that the public admin URL is secret or that passwords need no protection.

If sending fails, verify the saved Resend key's sending permission and the verified sender domain. Existing order emails and the support mailbox continue separately. An account email is confirmed by actual receipt and completion, not merely a successful build. Live account-email delivery has not been tested by the agent during this phase.

## How editing works

- **Run your shop:** products, categories, orders, inbox, finance and prepared discount codes.
- **Edit your website:** page wording, homepage video, reusable files, colours/movement and delivery/business settings.
- **Your account:** saved revision history, password, recovery email and administrator access.
- **Where changes appear:** each relevant section identifies affected customer pages and links to the live page.
- **Website text:** choose a friendly page name and search actual customer wording. Internal endpoints, source paths and configuration tokens are excluded from the editing controls. Shared phrases identify all mapped page locations.
- **Save draft:** saves privately. **Preview saved draft** shows the saved content in a phone/desktop frame or separate authenticated tab. Save draft first, then Refresh preview for newly saved edits.
- **Save & update store:** publishes website text/images/settings. Visible product/category saves publish through their existing rules. Uploading a file alone does not place it on the storefront.
- **Refresh workspace:** fetches current stored data and reusable files. It is disabled while editing unsaved changes or saving. Navigation/reload warns about unsaved website or product changes.
- Same-browser storefront tabs refresh immediately after a successful relevant save. Other browsers/devices retain the existing two-second public revision checks while online/visible, so network/server processing still affects update time. No zero-latency guarantee is made.

## Performance changes

The open workspace uses native history navigation and existing in-memory state for section changes, without requesting a new server page/full snapshot on each sidebar click. Reloading or directly visiting a protected URL still checks the session and database membership. Private snapshots are not persisted in local storage or shared between users through a global cache.

Disabled unnecessary admin/public-link prefetching, memoised initial document parsing and page-based copy filtering, reused/deduplicated the file library, removed redundant connection checks from normal snapshot refreshes and made successful text publication visible without waiting for a full workspace reload. Background reads do not advance an edited document's saved base version. Unsaved changes and stale-write checks remain.

Draft frames permit same-origin framing only on authenticated `/admin/preview` pages; public pages keep frame protection. Nonce-bearing HTML remains private/no-store and is not placed in a shared HTML cache. The approved public film, navigation, products and bag design are preserved.

## Research and scope

The grouped management tasks, customer-page controls and explicit saved preview/publishing state follow patterns documented by [Shopify's theme editor](https://help.shopify.com/en/manual/online-store/themes/customizing-themes/edit) and [WooCommerce order management](https://woocommerce.com/document/managing-orders/). This store remains its own Next.js/Supabase application; no third-party admin system was copied or installed.

Prepared coupons do not yet redeem at checkout. Payment refunds/exchanges, automatic carrier fulfilment/labels/tracking, newsletter/subscribers and other previously queued features are not silently made live by a dashboard redesign. Existing supported functions must be distinguished from these unfinished integrations.

## Verification

Production build, all 164 database/model checks, 37 admin, 11 mobile, 10 payment/email, 3 shipping and 3 inbox browser checks passed locally. Navigation tests measured 0 server-page requests across all section switches. See the latest development notes for timings and limitations. Tests use disposable records and dummy provider services. No real user, payment, email, postage, hosted inventory or deployment was created/changed by the agent during these tests. A real client account and actual mailbox recovery still need the owner workflow above after deployment.
