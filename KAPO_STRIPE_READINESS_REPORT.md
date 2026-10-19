# KAPO Stripe readiness report

Date: 18 October 2026  
Site: shopkapo.com  
Scope: audit, repair, and test of the existing Stripe checkout. Live payments were not enabled. No live card, live refund, live shipping label, or customer email was sent.

**Final assessment: NOT READY**

Stripe test keys are not configured in the local environment, so Checkout Sessions, test-card payments, and signed webhook delivery could not be exercised against the Stripe API. Shipping quotes in Shippo test mode did work.

## A. Existing architecture

KAPO sells catalog-priced keycaps. The server prices the cart. The browser never supplies the amount that gets charged.

1. The shopper enters a U.S. address on `/checkout`.
2. `POST /api/checkout/rates` prices the cart from `lib/catalog.ts`, validates the address, asks Shippo for rates, and stores a shipping quote. Quotes expire after `KAPO_SHIPPING_QUOTE_TTL_SECONDS` (default 30 minutes). An address can request at most 8 quotes per 10 minutes.
3. `POST /api/checkout/session` creates a pending order and a Stripe Checkout Session with `ui_mode: "elements"` and `mode: "payment"`.
4. The page mounts Stripe Checkout Elements (`@stripe/react-stripe-js` Checkout Elements, not a hand-rolled PaymentIntent form). The Pay button calls `checkout.confirm`.
5. Stripe redirects to `/order-confirmation?session_id={CHECKOUT_SESSION_ID}`. That page reads the database. It does not mark an order paid.
6. `POST /api/webhooks/stripe` verifies the Stripe signature on the raw body, then settles the order only when `checkout.session.completed` or `checkout.session.async_payment_succeeded` has `payment_status: paid` and the charged subtotal, discount, shipping, tax, total, and address match the stored quote.
7. A paid order moves to production status `awaiting_production` and appears in KAPO Admin. Labels are purchased later by an authenticated admin, with a $15 per-label cap and a $50 per-day cap. Webhooks and the support chat cannot buy labels.

SDK and API:

| Piece | Value |
| --- | --- |
| Server SDK | `stripe` npm package 23.0.0 |
| API version sent by that SDK | `2026-09-30.endive` (SDK default; the app does not override it) |
| Browser SDK | `@stripe/stripe-js` 10.1.0 and `@stripe/react-stripe-js` 7.0.0 |
| Checkout style | Checkout Sessions in Elements mode, plus the Payment Element inside that session |
| Payment methods | Not hard-coded. Stripe uses the methods enabled on the KAPO Stripe account |
| Currency | `usd` (`KAPO_DEFAULT_CURRENCY`) |
| Ship-to | United States only (`KAPO_SHIP_TO_COUNTRIES` defaults to `US`) |
| Tax | `automatic_tax` when `STRIPE_TAX_ENABLED=true`. It is currently off. Line items use tax behavior `exclusive` and Stripe tax code `txcd_99999999` (general tangible goods). Shipping uses `txcd_92010001`. Tax is not added in the catalog price as well. |
| Prices | Flat keycap $6.99. Artisan keycap $11.99. The KAPO Pad is not for sale until an admin price and inventory are set. |
| Secrets | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` are read from the environment. The publishable key is the only one returned to the browser. Logs drop fields whose names look like email, address, token, secret, phone, or street. |
| Deploy runtime in this repo | Cloudflare Workers through vinext (`npm run dev` / `wrangler`). Environment variables have to exist both in local `.env.local` / `.dev.vars` and in the production Worker (or Vercel, if that is still the production host). This audit did not open the Stripe Dashboard or the production host’s environment settings. |

`POST /api/checkout` is an old stub. It returns HTTP 409 and tells the client to use the checkout page. The live endpoints are `/api/checkout/rates`, `/api/checkout/session`, and `/api/checkout/config`.

Order confirmation email is sent by Resend from `KAPO Orders <orders@shopkapo.com>` after the webhook marks the order paid. The template includes the order number, lines, quantities, prices, shipping, tax, total, a link to `/account/orders/{orderNumber}`, and `support@shopkapo.com`.

Refunds are created only from the authenticated admin order route. Stripe’s `charge.refunded` webhook updates `refundedCents` and payment status. It does not change shipping or production history.

## B. Problems found

| Severity | Problem | Where | Consequence |
| --- | --- | --- | --- |
| Blocker | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and `STRIPE_WEBHOOK_SECRET` are unset in `.env.local` and `.dev.vars`. | Environment | Checkout cannot open a payment. Webhooks answer HTTP 503. No Stripe sandbox call was possible. |
| High, fixed | An open Checkout Session was reused even if the shopper changed the shipping rate or discount. A completed session could be replaced with a second session. The idempotency key could replay an expired session for 24 hours. | `lib/commerce/store.ts` | Wrong shipping amount, or a second charge for one quote. |
| High, fixed | A webhook still marked `processing` was treated as a finished duplicate and acknowledged with HTTP 200. | `lib/email/policy.ts`, `lib/commerce/store.ts` | If the worker died mid-event, Stripe would stop retrying and the order could stay unpaid. |
| High, fixed | If the order row was not visible yet, payment and refund events were acknowledged as processed. A refund that arrived while payment was still `pending` could set `partially_refunded` and then block the later “paid” update. An older refund amount could overwrite a newer one. | `lib/commerce/store.ts`, `lib/commerce/status.ts` | Lost payments, stuck orders, or a refund total moving backward. |
| Medium, fixed | Payment success sent both `payment_confirmation` and `order_confirmation`. | `lib/commerce/store.ts` | Two emails for one payment. |
| Medium, fixed | The Checkout return URL used the request origin. | `app/api/checkout/session/route.ts` | A forged Host header could send the shopper to another site with the Checkout Session id. |
| Low, fixed | The Pay button could submit twice before React disabled it. A quote stayed on screen after the cart changed. | `components/CheckoutExperience.tsx` | Double confirm attempt, or payment against a cart the shopper had already edited. |
| Medium, open | Stripe Tax is off (`STRIPE_TAX_ENABLED` unset). `stripeTaxTransactionId` is never saved. Business tax registration was not verified. | `lib/commerce/env.ts`, `lib/commerce/store.ts` | No sales tax is collected. Do not turn on live tax jurisdictions without a separate decision. Checkout’s automatic tax, once enabled, is the only tax calculation; catalog prices are tax-exclusive, so tax is not added twice. |
| Medium, open | Stripe account verification, payout bank, statement descriptor, and webhook endpoint health were not visible from this repo. | Stripe Dashboard | Cannot claim the account can accept live charges or pay out. |
| Low, open | A declined card does not emit `checkout.session.async_payment_failed`. The session stays open so the shopper can retry. That is intentional. `payment_intent.payment_failed` is not handled. | `lib/commerce/store.ts` | A single decline does not create a paid order and does not permanently fail the quote. |
| Info | `POST /api/checkout` is unused by the current page. | `app/api/checkout/route.ts` | Harmless 409. Left in place so old clients are not sent into a second payment implementation. |

Local env shape, with secret values omitted:

| Variable | Local state |
| --- | --- |
| `STRIPE_SECRET_KEY` | unset |
| `STRIPE_PUBLISHABLE_KEY` | unset |
| `STRIPE_WEBHOOK_SECRET` | unset |
| `STRIPE_TAX_ENABLED` | unset (treated as false) |
| `KAPO_ALLOW_LIVE_PAYMENTS` | `false` |
| `KAPO_ALLOW_LIVE_LABELS` | `false` |
| `SHIPPO_MODE` | `test` |
| `SHIPPO_TEST_API_KEY` | present, test prefix |
| `SHIPPO_LIVE_API_KEY` | present, not selected while mode is test and live labels are off |
| `RESEND_API_KEY` | present; not used to email anyone in this audit |
| `KAPO_PUBLIC_SITE_URL` | `https://shopkapo.com` |
| `KAPO_SHIPPING_ORIGIN` | U.S. origin with street, city, state PA, and ZIP |
| `KAPO_DISCOUNT_CODES` | unset, so no public discount codes are active |
| `KAPO_SHIP_TO_COUNTRIES` | unset, so the code defaults to `US` |

`sk_live_` and `pk_live_` are rejected unless `KAPO_ALLOW_LIVE_PAYMENTS=true`. That flag was not turned on.

## C. Changes implemented

- Checkout continuation now reuses an open session only when the rate and discount are unchanged. A completed or paid session is not replaced. A changed rate expires the old open session before a new one is created. The idempotency key includes the previous session id so an expired session is not replayed (`lib/commerce/checkout-session.ts`, `lib/commerce/store.ts`).
- Production return URLs are pinned to `KAPO_PUBLIC_SITE_URL`. Localhost is allowed only outside production.
- Webhook claims return “in progress” (HTTP 409, so Stripe retries) while another delivery is fresh. A claim stuck in `processing` for 90 seconds, or a claim marked `failed`, can be taken again. Duplicate `processed` events stay duplicates.
- Missing orders and refunds that arrive before payment settlement are retried instead of acknowledged. Refund totals only move upward. Shipping and production rows are not rewritten by a refund.
- If payment was already saved and the email send failed, a retried webhook sends the confirmation again. The notification dedupe key still prevents a second email after a successful send. A Resend failure is stored as `failed` and does not unpay the order.
- Successful payment sends one template: `order_confirmation`.
- The Pay button ignores a second submit while the first confirm is running. Changing the cart hides the previous quote, rates, and payment step.
- Order emails include `support@shopkapo.com` and the contact link.

Checkout layout, copy, and the payment step’s visual design were left as they were.

## D. Test results

`npx tsc --noEmit` passed after the code changes. `npm run test:commerce` passed 28 tests. ESLint on the edited files reports one existing warning: the checkout summary uses an `<img>` tag.

| Test | Result | Evidence | Stripe sandbox or mock |
| --- | --- | --- | --- |
| Server prices for one artisan, quantity 2 flat plus one artisan | PASS | Unit test. Artisan 1199 cents, flat 699 cents. Subtotal `699*2+1199`. | Mock / catalog |
| Zero, negative, and fractional quantities | PASS | Unit test and local `POST /api/checkout/rates` HTTP 400 `invalid_cart` | Mock, then local server |
| Unknown product | PASS | HTTP 400 “not available” | Local server |
| Client-supplied `unitPrice: 1` ignored | PASS | Unit test still prices the artisan at 1199 cents | Mock |
| Macropad not for sale, including spoofed ids | PASS | Unit test | Mock |
| Discount percent and amount, capped at subtotal; fake code rejected | PASS | Unit test. `KAPO_DISCOUNT_CODES` is empty in the environment, so live checkout has no codes. | Mock |
| Valid U.S. address and international rejection | PASS | Unit test. Local API: country `CA` returns “ships within the United States”. | Local server |
| Shippo test rates for a U.S. destination | PASS | Direct Shippo test API: 3 USD rates, USPS, amounts 826, 525, and 3251 cents. Invalid address rejected. `labelPurchased: false`. | Real Shippo test API |
| Browser checkout for one Gloop artisan to Washington, DC 20500 | PASS | Page showed subtotal $11.99 and three rates: Normal $5.25, Fast $8.26, Super fast $16.06. No label purchase. | Real Shippo test API through the local site |
| Shipping quote expiration | PASS | Unit test, 1800 second TTL | Mock |
| Changed cart after a quote | PASS | UI keeps the quote only while the product/quantity key matches. Code review plus checkout page render. | Browser, no Stripe |
| Stripe totals must match quote before paid | PASS | `assessPaidSession` unit test. Mismatched total returns `review`. Unpaid returns `ignore`. Tax is added once: merchandise − discount + shipping + tax. | Mock |
| Continue to payment without Stripe keys | PASS | Browser message “Stripe is not configured yet.” Local session API HTTP 503 `stripe_not_configured`. | Local server, no Stripe call |
| Successful test card `4242` / `pm_card_visa` | BLOCKED | No `sk_test_` key | Not run |
| Declined card | BLOCKED | No test key | Not run |
| Insufficient funds | BLOCKED | No test key | Not run |
| Authentication required and abandoned authentication | BLOCKED | No test key | Not run |
| Abandoned checkout, refresh, retry, expired session, network drop | BLOCKED as end-to-end Stripe flows | Code path covered: expired Checkout Session does not mark paid; confirmation page waits for the webhook; Pay button is locked while confirming. | Not a Stripe API call |
| Double Pay click | PASS | `submitting` ref returns early on a second submit. Not exercised against Stripe. | Code |
| Duplicate Checkout Session creation | PASS | Unit test: same terms reuse; changed terms replace and expire; completed session waits. Idempotency keys differ. | Mock |
| Webhook signature accept and reject | PASS | Stripe SDK `constructEventAsync` accepted `whsec_test_secret` and rejected `whsec_other`. Local endpoint with no signature returned HTTP 503 “not configured”, not HTTP 200. | Stripe library, not the Stripe API |
| Wrong-environment webhook secret | PASS | Same unit test rejects a different `whsec_` | Stripe library |
| Simultaneous webhook deliveries | PASS | `webhookClaimDecision("processing", 0)` is `in_progress` (HTTP 409, not an ack). Age 90s reclaims. `processed` stays duplicate. `failed` can be claimed again. Not run as two parallel HTTP requests against Stripe. | Mock |
| Out-of-order refund before payment | PASS | `applyRefundSnapshot` returns `retry` while status is `pending`. A smaller later refund amount is ignored. | Mock |
| Refund does not rewrite shipping | PASS | `applyRefund` updates payment status and `refundedCents` only. Shipping status is untouched in that function. | Code |
| One order confirmation email, with totals and support | PASS | `paymentSuccessEmails()` is only `order_confirmation`. Rendered email contains the line, $29.40 sample total, shipping, tax, order link, and `support@shopkapo.com`. Sender helper is `KAPO Orders <orders@shopkapo.com>`. | Mock |
| No email before payment | PASS | Confirmation is called only after the conditional paid update. | Code |
| Duplicate webhook does not send a second email | PASS | Notification dedupe key. A successful row is not sent again. | Code / existing email tests |
| Resend failure keeps the payment | PASS | `deliverEmail` returns `failed` and does not throw. Retry test for HTTP 429 exists. No email was sent to a customer. | Mocked fetch |
| Label purchase blocked from a Stripe webhook and from a non-admin | PASS | Unit test. Caps clamp to $15 and $50 unless an explicit override flag is set. | Mock |
| Customer cannot view another customer’s order | PASS | `customerCanViewOrder` unit test | Mock |
| Admin refund route requires an admin session | PASS | `app/api/admin/orders/[orderId]/route.ts` returns 403 without `getAdminUser`. Not called against Stripe. | Code |
| Typecheck | PASS | `tsc --noEmit` | n/a |

No live Shippo transaction was created. The support chat code has no label-purchase or Stripe refund call.

## E. Integration verification

**Stripe.** The integration is implemented and the unsafe session-reuse and webhook-ack paths were repaired. It is not verified against Stripe. Local config returns `publishableKey: null`. Test versus live separation exists in code (`sk_test_` / `pk_test_` required unless `KAPO_ALLOW_LIVE_PAYMENTS=true`). Dashboard payment methods, statement descriptor, and webhook delivery were not inspected.

**Shippo.** Test mode is on and was used. A real test-mode rate request returned three tracked U.S. rates. Address validation rejected an invalid U.S. address. Labels are a separate admin action after payment, with the $15 / $50 caps. Live purchasing is off.

**Resend.** The confirmation template and retry behavior passed unit tests with a mocked Resend API. The local `RESEND_API_KEY` was not used. No message was sent to a customer or to an internal inbox.

**Database.** Orders, payments, quotes, webhook claims, and notifications are modeled in D1 (`db/schema.ts`), including unique indexes on Checkout Session id and PaymentIntent id. This audit wrote shipping quotes only to the local dev database when the checkout page and rate API were exercised. Production D1 was not migrated or written.

**Admin.** Paid orders are listed by `dashboard()` and edited through the admin order route. Unpaid orders cannot start production or buy a label. This audit did not sign into production admin.

## F. Manual configuration remaining

Do this in Stripe test mode first. Do not paste secret keys into the repository or into chat.

1. In the Stripe Dashboard, switch to **Test mode**.
2. Developers → API keys. Copy the test secret (`sk_test_...`) and test publishable key (`pk_test_...`).
3. Developers → Webhooks → Add endpoint.
   - Local: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the CLI `whsec_` it prints.
   - Production URL: `https://shopkapo.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
4. Put these on the production host and in `.env.local` / `.dev.vars` for local work:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_TAX_ENABLED=false` until tax registration is an explicit decision
   - `KAPO_ALLOW_LIVE_PAYMENTS=false`
   - `KAPO_PUBLIC_SITE_URL=https://shopkapo.com`
5. Settings → Branding and Business. Confirm the public name, support email (`support@shopkapo.com`), website `https://shopkapo.com`, and the statement descriptor you want on card statements.
6. Settings → Payment methods. Enable the methods KAPO wants (card, Apple Pay, Google Pay, and wallets). Checkout does not override that list.
7. Settings → Customer emails. KAPO already sends the order email through Resend. Turn off Stripe’s own successful-payment email if you do not want a second receipt. The Checkout Session still sets `receipt_email`, which can make Stripe send a receipt.
8. Tax: leave it off until the business confirms where it is registered. Then set `STRIPE_TAX_ENABLED=true` only for those jurisdictions. Do not add jurisdictions from this repo.
9. After the test keys are present, repeat a $11.99 artisan checkout with Stripe’s test cards (`4242` success, `4000...0002` decline, `4000...9995` insufficient funds, `4000...3155` authentication). Confirm one order, one Resend email to an internal address, and no Shippo label.
10. Only after those test payments succeed, create a **live** webhook endpoint and live keys. Set `KAPO_ALLOW_LIVE_PAYMENTS=true` only when you explicitly want live charges. Keep `KAPO_ALLOW_LIVE_LABELS=false` until label purchasing is separately approved.

If production is Vercel, set the same variables in Project → Settings → Environment Variables for Production, then redeploy. If production is the Cloudflare Worker, set them with Wrangler secrets or the Worker dashboard. This audit did not log into either host.

## G. Production launch blockers

1. Stripe test secret, publishable key, and webhook secret are missing, so no sandbox payment has been completed.
2. Stripe account verification, representative eligibility, and payout bank were not checked. Do not treat them as done.
3. Statement descriptor, support email, and website were not confirmed in the Dashboard.
4. Webhook delivery health in the Dashboard is unknown because no endpoint is configured in this environment.
5. Stripe Tax registration was not verified. Tax is intentionally off.
6. Live payments must stay off until the test-card checklist in section F passes.
7. `SHIPPO_LIVE_API_KEY` is present locally. It is unused while `SHIPPO_MODE=test` and `KAPO_ALLOW_LIVE_LABELS=false`. Do not flip those flags as part of turning on Stripe.

## H. Final readiness assessment

**NOT READY**

The checkout design, server-side pricing, U.S. shipping quotes, webhook signature check, idempotent order updates, single confirmation email, and label safeguards are in place and covered by unit tests plus a real Shippo test-mode quote. Accepting real cards still depends on test keys, a signed webhook endpoint, and a full test-card payment that this environment could not run.
