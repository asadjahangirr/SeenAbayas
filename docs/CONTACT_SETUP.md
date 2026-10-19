# Contact form setup

The `/contact` page and `/api/contact` endpoint are implemented. Email delivery is not enabled or verified against a real provider yet. Without all four valid settings below, the page shows the support email and disables submission; the server returns 503. It never simulates a successful send.

## Email delivery

1. Create a Resend account for the store, preferably under the client's ownership when available.
2. Add a domain you control in Resend and complete its DNS verification. A sending subdomain can be used. Do not replace existing inbox/MX records just to enable sending.
3. Create a sending-only API key restricted to the verified sending domain where supported.
4. Add `RESEND_API_KEY` to `.env.local`. Add `CONTACT_FROM_EMAIL` as a plain email address on that verified domain, without a display name or angle brackets. The application adds the SEEN ABAYAS display name.

The recipient is fixed server-side to `info@seenabayas.co.uk`. Confirm that this inbox exists and can receive mail. The customer's validated email address is used as Reply-To. The customer cannot choose the sender or recipient. Messages contain name, email, phone, plain-text message, a browser-generated submission timestamp in UTC and a request reference. No mailing-list signup is performed.

Official references: [domain verification](https://resend.com/docs/dashboard/domains/introduction), [send email](https://resend.com/docs/api-reference/emails/send-email), [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Bot protection

1. Create a Cloudflare Turnstile **managed** widget for the store.
2. Allow the actual store hostname. Add `localhost` and `127.0.0.1` when testing locally, as supported by the widget's hostname settings.
3. Add `CONTACT_TURNSTILE_SITE_KEY` and `CONTACT_TURNSTILE_SECRET_KEY` to `.env.local`. The site key is public; the secret and Resend API key stay on the server. Do not use `NEXT_PUBLIC_` for these secrets.
4. Restart the dev server after changing configuration.

The browser loads the widget only when the contact integration is fully configured. The CSP permits Cloudflare's challenge iframe when the widget has a configured site key; its script carries the document nonce. The server verifies the token, `contact` action and hostname before emailing. There is no production bypass. A honeypot, bounded request body, strict JSON validation, same-origin checks, duplicate submission lock and Resend idempotency also apply.

A bounded, process-local limiter permits at most three send attempts per email per fifteen minutes and thirty per minute per process. **Configure a shared hosting/WAF rate limit for `/api/contact` before launch**: process memory does not provide a global limit across instances or survive a restart. Do not trust client-supplied forwarding headers as a rate-limit identity.

Official references: [widget rendering](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/), [server verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

## Verification and launch

- Local automated tests inject provider responses in memory; they send no email and make no Turnstile requests.
- `npm run test:contact-ui` uses synthetic configuration and intercepts browser requests to exercise validation, retry feedback, duplicate submission prevention and the nonce CSP after client navigation. It does not test real providers.
- After configuring real services, send a test enquiry from `/contact`, confirm it is accepted by Resend, arrives in the support inbox, and replies address the customer correctly.
- Check failure handling and security challenge expiry, including navigation to Contact from another page.
- The success state means the provider accepted the message; it does not prove inbox delivery.
- Review contact data processing, Resend and Cloudflare disclosures, retention and the final privacy policy with the client's actual business details before launch. No contact records are currently stored in Supabase.
- Add the same secrets to the eventual hosting environment. Never commit them or paste them into chat. `.env.example` contains blank configuration fields only.
