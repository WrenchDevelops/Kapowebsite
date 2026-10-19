# KAPO Stripe and Shippo setup

KAPO charges customers for products and shipping at checkout, then buys the Shippo label later from the admin order page. Do not turn on live charges or live labels until you have finished a sandbox order.

## What you need to provide

Copy `.env.example` to `.dev.vars` for local development. This site runs as a Cloudflare Worker, and Wrangler reads `.dev.vars` (or `.env` / `.env.local` if `.dev.vars` is absent). A variable exported only in the shell is not visible to the Worker unless `CLOUDFLARE_INCLUDE_PROCESS_ENV=true`. On the host, set the same names as runtime secrets. Never commit real keys. `.dev.vars` is gitignored.

| Name | Required to test | Purpose |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes | Secret key, `sk_test_...` while testing |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Publishable key, `pk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Yes, for paid orders | Signing secret for `/api/webhooks/stripe` |
| `SHIPPO_MODE` | Yes | `test` until you explicitly approve live postage |
| `SHIPPO_TEST_API_KEY` | Yes | `shippo_test_...` token used for rates and test labels |
| `SHIPPO_LIVE_API_KEY` | Live only | Stored, but unused while `SHIPPO_MODE=test` |
| `SHIPPO_API_TOKEN` | No | Legacy fallback. A live token here is ignored in test mode |
| `SHIPPO_WEBHOOK_TOKEN` | One of the two Shippo checks | Self-generated token in the webhook URL |
| `SHIPPO_WEBHOOK_SECRET` | One of the two Shippo checks | HMAC secret from Shippo, if they enable it |
| `KAPO_SHIPPING_ORIGIN` | Yes | JSON origin address in Pennsylvania |
| `KAPO_ADMIN_EMAILS` | Yes, for the dashboard | Comma-separated admin emails |
| `KAPO_DEFAULT_CURRENCY` | No | Defaults to `usd` |
| `STRIPE_TAX_ENABLED` | No | `true` only after Stripe Tax is configured |
| `KAPO_DISCOUNT_CODES` | No | Example: `CREW10:percent:10,WELCOME:amount:500` |
| `RESEND_API_KEY` and `KAPO_EMAIL_FROM` | No | Without these, emails stay queued |
| `KAPO_ALLOW_LIVE_PAYMENTS` | Live only | Must be `true` before `sk_live_` charges |
| `KAPO_ALLOW_LIVE_LABELS` | Live only | Must be `true` together with `SHIPPO_MODE=live` before any live label purchase |
| `KAPO_LABEL_MAX_CENTS` | No | Hard ceiling is 1500 ($15) unless `KAPO_LABEL_LIMITS_OVERRIDE=true` |
| `KAPO_LABEL_DAILY_MAX_CENTS` | No | Hard ceiling is 5000 ($50 per America/New_York day) unless the override is true |

`amount` discounts are integer cents. Percent discounts apply to merchandise only, not shipping.

## Stripe

1. Create a Stripe account and stay in test mode.
2. Copy the test secret and publishable keys from Developers → API keys.
3. In Settings → Payment methods, enable cards plus Apple Pay and Google Pay. Checkout Elements uses the account’s eligible methods. Apple Pay also needs the domain registered in Stripe after the site has HTTPS.
4. Add a webhook endpoint pointing at `https://YOUR_DOMAIN/api/webhooks/stripe`.
5. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `charge.refunded`.
6. Copy the endpoint signing secret into `STRIPE_WEBHOOK_SECRET`. Test and live endpoints have different secrets.
7. For local tests, forward events with the Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

Orders become paid only in the webhook handler. The confirmation page can say Stripe has not confirmed the order yet. A redirect is not treated as payment.

### Stripe Tax

Sales tax is off until `STRIPE_TAX_ENABLED=true`. Before turning it on:

1. Open Stripe Tax and add the business address.
2. Register in each state where KAPO has nexus. The shipping origin is Pennsylvania, so confirm whether a Pennsylvania registration is required before collecting tax there.
3. KAPO sends tangible-goods tax code `txcd_99999999` and shipping tax code `txcd_92010001`.
4. Preset prices are tax-exclusive. Stripe adds tax on top when the flag is on.
5. Checkout commits the tax transaction. Refunds issued through this admin flow are sent to Stripe; Stripe Tax reverses Checkout tax for those refunds when automatic tax was used. This app does not file returns for you.

If the flag is on before Stripe Tax is ready, checkout returns a configuration error instead of charging a tax-free total.

## Shippo

1. Create a Shippo account and copy the test API token (`shippo_test_...`).
2. Connect the USPS, UPS, and any other carrier accounts you want to compare. Test mode returns carrier test rates. It does not buy live postage.
3. Set the origin. Example:

```json
{"name":"KAPO","street1":"123 Main St","city":"Philadelphia","state":"PA","zip":"19103","country":"US","email":"orders@example.com","phone":"2155550100"}
```

4. Add a webhook in Shippo for `track_updated` and `transaction_updated`.
5. Shippo’s normal webhook protection is a self-generated URL token, not a signature. Put a long random token in the webhook URL: `https://YOUR_DOMAIN/api/webhooks/shippo?token=YOUR_TOKEN`. Set that same value as `SHIPPO_WEBHOOK_TOKEN`.
6. HMAC (`Shippo-Auth-Signature: t=timestamp,v1=signature`) is optional and is set up with Shippo support. If you have that secret, set `SHIPPO_WEBHOOK_SECRET`. When both values are set, both checks must pass.
7. Optional: `KAPO_SHIPPO_ENFORCE_IP_ALLOWLIST=true` accepts only Shippo’s published webhook IPs.

Checkout asks Shippo for rates and stores the chosen rate on the order. It never buys a label. Stripe webhooks and Shippo webhooks never buy a label either. An authenticated admin approves one exact carrier and price on the order page. The server refuses a label over $15 and refuses the purchase when that day’s held postage would pass $50. A second purchase for the same order is blocked while a label is pending, succeeded, uncertain, or waiting on a void. Uncertain Shippo responses stay locked until an admin checks Shippo and clears the attempt.

Domestic US checkout is the only destination today. `KAPO_SHIP_TO_COUNTRIES` defaults to `US` so another country can be added later without rewriting the rate flow. International customs are not implemented.

## Package weight and size

These are configured packing assumptions, not carrier rates. Weigh a packed sample and change them before launch.

- Flat keycap: 12 g
- Artisan keycap: 28 g
- Mailer: 8 × 6 × 2 in, plus 35 g packaging, used for smaller orders
- Larger box: 10 × 8 × 4 in, plus 80 g packaging, used at 9 pieces or 400 g of product
- Override the mailer with `KAPO_PARCEL_LENGTH_IN`, `KAPO_PARCEL_WIDTH_IN`, `KAPO_PARCEL_HEIGHT_IN`, and `KAPO_PACKAGING_WEIGHT_GRAMS`

`KAPO_SHIPPING_HANDLING_FEE_CENTS` defaults to `0`. Any value is added to the customer’s Shippo rate. It is not added again when the label is purchased.

`KAPO_PRODUCTION_DAYS_MIN` and `KAPO_PRODUCTION_DAYS_MAX` default to 5 and 10. Checkout shows that range separately from the carrier’s transit estimate. Change them to the real production window.

Shipping quotes expire after `KAPO_SHIPPING_QUOTE_TTL_SECONDS` (default 30 minutes). Label rates in admin expire after 24 hours and must be refreshed. Shippo itself only sells rates that are less than 7 days old.

## Database

Commerce tables live in Cloudflare D1. The binding name is `DB`, set in `.openai/hosting.json`.

The migration is `drizzle/0000_commerce.sql`. It also creates a partial unique index so an order cannot have two active labels.

Local `npm run dev` applies that SQL automatically. Production does not, unless you set `KAPO_AUTO_MIGRATE=true`. Apply `drizzle/0000_commerce.sql` to the hosted D1 database before taking orders.

Amounts are integer cents. Product names and unit prices are copied onto the order at purchase.

## Admin and customers

- Dashboard: `/admin`
- An admin is a signed-in ChatGPT user whose email is in `KAPO_ADMIN_EMAILS`.
- `KAPO_ADMIN_DEV_BYPASS=true` works only when `NODE_ENV` is not `production`. Put it in `.dev.vars`, not only in the shell that starts `npm run dev`.
- Customers see orders on `/account` only when the signed-in user id or email matches the order.
- Label purchase, void, and refund actions are admin-only.
- Buying a label does not mark the order shipped. Use “Mark handed to carrier” after the drop-off. Delivered comes from Shippo tracking, not from a manual status.

## Email

If `RESEND_API_KEY` and `KAPO_EMAIL_FROM` are set, KAPO sends through Resend. Otherwise the notification is stored as queued and the dashboard count includes it. Templates cover payment, order confirmation, production started, ready to ship, shipment, tracking, delivery, and refund. A dedupe key stops webhook retries from sending the same message again. Shipment and delivery mail are sent only after those events actually happen.

## Sandbox test, not live

Use Stripe test cards and a Shippo test token. Do not set the live-allow flags. Suggested sandbox pass:

1. One keycap, then a cart with two characters and a quantity above one.
2. A successful test card, then a canceled payment and a declined card.
3. Replay the same Stripe webhook and confirm one order and one email.
4. An incomplete address, a second shipping service, and a quote left until it expires.
5. A discount code, with and without Stripe Tax.
6. Refresh label rates, purchase a test label, try to purchase it again, then void it.
7. Send a `track_updated` sample from Shippo and confirm the tracking row.
8. Refund the test payment from the order page.
9. Open `/admin` as a non-admin and open another customer’s order number while signed in.

Automated tests in `tests/commerce.test.ts` mock these decisions and do not call Stripe or Shippo.

## Go live

1. Repeat the sandbox checklist on the hosted test deployment.
2. Switch `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` to live values. Create a separate live webhook endpoint.
3. Set `SHIPPO_MODE=live` and `KAPO_ALLOW_LIVE_LABELS=true` only when you want real postage. Keep `SHIPPO_LIVE_API_KEY` as the live token and point the live webhook at the same path with a new token.
4. Set `STRIPE_TAX_ENABLED=true` only after registrations are active.
5. Set `KAPO_ALLOW_LIVE_PAYMENTS=true` and `KAPO_ALLOW_LIVE_LABELS=true` only when you explicitly want real charges and real postage.
6. Place one small live order, confirm the webhook, produce it, buy one real label, and confirm tracking before announcing checkout.

This repository has not been switched to live mode by the integration itself.
