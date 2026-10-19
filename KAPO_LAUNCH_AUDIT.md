# KAPO pre-launch audit

Audit date: October 18, 2026 (America/Los_Angeles).

Workspace: `C:\Users\bende\OneDrive\Desktop\Kapo website`.

## Launch decision

**Not ready to accept orders.** The storefront is substantially implemented, but the production checkout currently reports that Stripe is not configured. The Vercel build has no usable database adapter, and the customer identity flow does not establish ownership of an email address. These are concrete blockers, independent of the unfinished live integration tests.

Prioritize secure identity and a working production database, then Stripe → Shippo → order management → transactional email → production acceptance testing. Do not enable live payments merely to remove the current checkout warning.

This audit made no application fixes, deployments, payments, refunds, label purchases, subscriber sends, or production database changes. Existing uncommitted work was audited as found. Build outputs were regenerated; Next's generated change to `next-env.d.ts` was restored. Only this report is an intentional source-tree addition.

## Status definitions and evidence limits

- **WORKING:** The particular behavior was executed and verified. This never implies that its entire integration works.
- **PARTIAL:** Implementation exists, but a required behavior or recovery path is incomplete.
- **BROKEN:** A runtime, automated, or isolated source-function test reproduced a failure.
- **MISSING:** No implementation was found in the inspected project.
- **UNVERIFIED:** Implementation or external configuration exists, but the relevant behavior was not tested with current access and the read-only constraint.

Evidence consists of source inspection, existing automated tests, local browser checks, HTTP GETs, local SQLite opened read-only, migrations executed only against a new in-memory database, and authenticated GETs to Resend and Shippo. No private customer rows, credentials, or secret values are included here.

Additional failure probes transpiled existing functions in memory and injected synthetic identities, database failures, or provider results. They did not modify the functions on disk or contact providers. These establish the described code behavior, not the existence of a corresponding historical production incident.

Production HTTP responses do not prove that the deployed revision matches this uncommitted workspace. Vercel project settings, production secret inventory, remote D1 contents, backups, and provider webhook subscriptions were not accessible through the inspected project. The Stripe connector requires reauthentication and the Stripe CLI is not installed; no Stripe account configuration was verified.

## Verification results

| Check | Result | Meaning |
| --- | --- | --- |
| `npx tsc --noEmit --incremental false` | PASS | TypeScript passed on the audited source. |
| `npm run test:commerce` | PASS, 33/33 | Helper, template, signature, policy, and mocked email-client tests. Not a database or browser checkout suite. |
| `npm run build` | FAIL on Windows | Unix-style environment assignment is interpreted as a command. |
| PowerShell `$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'; npx vinext build` | PASS | Cloudflare/vinext build succeeds with equivalent environment setup. |
| `$env:VERCEL='1'; npx next build --webpack` | PASS | The configured Vercel build compiles; compilation does not supply a database or authentication gateway. |
| `npm test` | FAIL | Stops at the Windows build-script error before running tests. |
| `node --test tests/rendered-html.test.mjs` after build | FAIL, 2/2 | Unsupported `cloudflare:` import in Node, and missing starter skeleton files. |
| `npm run lint` | FAIL | 11 errors, 51 warnings. Targeted source lint reproduced the same counts. |
| `npm audit --omit=dev --json` | FAIL | 6 dependency entries flagged: 1 critical, 4 high, 1 moderate. See security findings. |
| Five SQL migrations applied to a fresh in-memory SQLite database | PASS | 23 tables created; active-label unique index exists. Does not prove remote migration state. |
| Two existing local D1 SQLite stores, read-only | PASS for table presence | Both contained all 18 checked commerce/support/marketing tables; both had zero orders, payments, labels, notifications, subscribers, and campaigns. No completed local sale was demonstrated. |
| 31 local page/variant HTTP checks | PASS, 31/31 HTTP 200 | Includes all eight characters with both `style` parameters, shop, previews, checkout shell, and policy pages. HTTP rendering does not verify every interaction. |
| Public domain | PASS for reachability | `https://shopkapo.com` redirects to `https://www.shopkapo.com/`, which returned 200 over HTTPS. Public responses identify Vercel. |
| Public checkout configuration | BLOCKED | GET `/api/checkout/config` returns no publishable key and “Stripe is not configured yet.” Local endpoint reports the same. |
| Public shop, robots, sitemap | PASS for HTTP availability | All returned 200. Search Console ownership/indexing was not verified. |
| Resend authenticated GET domain status | PASS | `shopkapo.com` is marked verified; returned DKIM and SPF records are verified. No email was sent. |
| Shippo authenticated GET carrier accounts | PASS | Test credential accepted; full 15-account result included active FedEx, UPS, and USPS test accounts. Rates and label delivery were not exercised. |
| DMARC lookup | No record found | `Resolve-DnsName -Type TXT _dmarc.shopkapo.com` returned DNS name does not exist. This is one resolver's observation, not an inbox-deliverability test. |
| Instagram URL | HTTP 200 | The linked URL responds. Account ownership, intended branding, and availability to a signed-out shopper remain unverified. |

### Browser-verified cart behavior

In a temporary local browser tab, added Spore Artisan and Flat as separate lines. The subtotal was $18.98. Increased Artisan to quantity two; its line total became $23.98 and cart subtotal $30.97. Removed that line; the remaining Flat subtotal was $6.99. Navigated to checkout and verified that the address form and that item rendered. No shipping form or payment was submitted. These checks establish cart behavior for the exercised product, not all 16 variants or mobile checkout.

## Subsystem assessment

### 1. Storefront

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Homepage, shop, character index, eight character pages | WORKING for HTTP rendering | 31 page/variant checks passed; homepage browser tree contains all eight characters. `app/page.tsx`, `app/shop/page.tsx`, `app/characters/[slug]/page.tsx`. |
| Flat / Artisan prices and selection | WORKING for tested selection and server pricing | Browser switched Spore styles and added both; `priceCart` tests verify server pricing. $6.99 / $11.99 are in `lib/catalog.ts`. |
| All eight characters, both styles | UNVERIFIED for complete browser QA | All 16 URL variants returned 200 and all 16 expected product PNGs exist. Only Spore's interaction was exercised. |
| Cart quantity, removal, checkout navigation | WORKING for tested desktop journey | Browser evidence above; `components/CommerceProvider.tsx`, `components/CartView.tsx`. |
| Macropad preview and no-sale gate | WORKING for default server gate; UNVERIFIED for all builder interactions | Preview pages render, default state is not for sale, unit tests reject cart purchase until explicitly enabled with a price. `lib/catalog.ts`, `lib/commerce/products.ts`. |
| Navigation, search, carousels | PARTIAL verification | Desktop character/cart links worked; search and swipe/carousel code exist but were not exhaustively exercised. `components/SiteChrome.tsx`, `app/page.tsx`, `lib/catalog.ts`. |
| Mobile responsiveness and accessibility | UNVERIFIED visually; PARTIAL accessibility | Responsive CSS exists. No complete narrow-viewport or real-device journey was performed. Lint found accessibility errors listed below. |
| Product image paths | WORKING for checked file presence | All 16 expected keycap images exist. Real public assets referenced by the HTML scan were present; Vite's virtual entry URL was excluded from filesystem asset checks. No claim that renders match manufactured products. |
| Actual size, weight, fit and material claims | PARTIAL / UNVERIFIED physically | Product pages say MX-style stem and 3D-printed plastic; exact measured dimensions/material specification and keyboard-specific fit are not established. Parcel weights are code defaults, not measured evidence. |
| Repaired KAPO font | PARTIAL | TTF/WOFF2 files, including v3, exist in `public/fonts/`; application CSS uses Fredoka. No KAPO `@font-face` activation or completed font QA was found. |

### 2. Commerce: Stripe, totals, discounts, refunds

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Server-owned catalog prices, quantity bounds, discount arithmetic | WORKING at unit level | Tests cover pricing, merged quantities, capped discounts, domestic address checks and quote expiry. `lib/commerce/products.ts`, `discounts.ts`, `address.ts`. |
| Shipping quote → Checkout Session → Payment Element | UNVERIFIED end to end; BLOCKED in current deployment | Substantial implementation in `lib/commerce/store.ts`, `app/api/checkout/*`, `components/CheckoutExperience.tsx`. Both inspected checkout config endpoints block opening payment. |
| Successful payment, decline, wallets, asynchronous payment | UNVERIFIED | No provider payment was initiated. Session creation/update parameters have not been accepted by a configured Stripe account during this audit. |
| Shipping, tax and final totals | PARTIAL verification | Helper tests pass; selected quote shipping is passed to Stripe and checked afterward. `STRIPE_TAX_ENABLED` is disabled in the inspected configuration. Active registrations, tax behavior, rounding and charged totals are unverified. Do not equate a tax flag with tax compliance. |
| Stripe signature verification | WORKING for synthetic helper tests; UNVERIFIED on deployed endpoint | Route uses raw body and `constructEventAsync`; helper signature tests pass. Actual signing secret and subscribed events need verification. `app/api/webhooks/stripe/route.ts`. |
| Payment settlement from webhooks | PARTIAL | Handles completed and async-success events and gates on payment status; amount/address checks and conditional pending→paid update exist. Unique order/session/intent indexes exist. See recovery and concurrency risks below. |
| Exactly one complete paid order | UNVERIFIED | No order journey or concurrent real database webhook test was run. Passing helper tests does not prove this invariant. |
| Refunds | PARTIAL / UNVERIFIED externally | Admin can request remaining balance; API also accepts an amount. Stripe idempotency key and `charge.refunded` synchronization exist. No external refund was performed. Dashboard lacks a partial-refund amount control. |
| Cancellation | MISSING as an order state/action | Customer “Cancel order” opens support. `order_canceled` email template exists, but no cancellation transition/action/trigger was found. A refund alone is not a cancellation workflow. |
| Promotion management | PARTIAL | Environment-configured discount codes exist, but no discount CRUD, expiry, redemption caps, or customer-specific restrictions were found. Newsletter promotion drafts are a separate feature. |

### 3. Fulfillment: Shippo and order management

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Shippo credential and carrier access | WORKING for read-only test access | Authenticated carrier account GET returned 200 with active test carriers. `lib/commerce/shippo.ts`. |
| Address validation and shipping rates | UNVERIFIED externally | Implementation POSTs address/shipment objects. Those were intentionally not created under the read-only constraint. Normalization, selection, expiry and parcel helpers pass unit tests. |
| Unsupported destinations | WORKING at validation-helper level | Tests reject international addresses; UI is US-only. Does not prove every carrier supports every allowed domestic address. |
| Final parcel review and label safeguards | WORKING for tested policy helpers; UNVERIFIED as a complete purchase | Admin confirmation, per-label/day caps, an active-label unique index, live-label switch, audit log, and uncertain-result hold are implemented. Tests cover guard decisions. |
| Label purchase, PDF, tracking assignment | UNVERIFIED | No test or live label purchased. Purchase success deliberately does not mark a parcel shipped. `purchaseLabel`, `markShipped` in `lib/commerce/store.ts`. |
| Tracking ingestion | BROKEN for two reproduced recovery cases | Delivered→TRANSIT regression and retry suppression after a partial failure; see F05/F06. |
| Label void/refund reconciliation | PARTIAL | Immediate SUCCESS is handled. QUEUED/PENDING becomes `void_requested`, which blocks replacement; no polling or refund-completion handler was found to finish it. |
| Pending/uncertain label recovery | PARTIAL | Admin can clear an attempt after checking Shippo. Incoming successful transactions only restore missing tracking; they do not fully reconcile label state/cost or resume the workflow. |
| Weights and package dimensions | UNVERIFIED physically | Code defaults: 12 g Flat, 28 g Artisan, 35 g packaging, 8×6×2 inches. They must be checked against actual packed single/multiple orders. Do not present defaults as measured facts. |

### 4. Transactional emails

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Resend API access and sender-domain verification | WORKING for read-only verification | Domain API confirms SPF/DKIM status. Actual inbox delivery, reply mailbox operation, and sending permission remain unverified. |
| Templates and message data | WORKING for tested rendering | Tests inspect order totals, address, links, tracking facts, character artwork and inline wordmark attachment. `lib/commerce/email-template.ts`, `lib/email/messages.ts`, `lib/email/client.ts`. |
| Confirmation, shipping, delivered, refund triggers | PARTIAL | Trigger call sites exist in `lib/commerce/store.ts`; no actual order-triggered delivery was demonstrated. Tracking failure recovery is incomplete. |
| Cancellation email | PARTIAL | Template and studio preview exist; no cancellation workflow triggers it. |
| Retry handling | PARTIAL | Client retries 429/5xx/network failures; failed/queued transactional emails can be retried manually in admin. No automatic durable transactional-email worker was found. |
| Duplicate prevention | PARTIAL | Notification unique dedupe key and Resend idempotency headers exist, but sending occurs before durable notification persistence; see F12. |
| Responsive email-client QA | UNVERIFIED | HTML tests do not substitute for rendering in Gmail, Outlook, iOS Mail, dark mode and blocked-image conditions. |
| DMARC | MISSING in observed DNS response | Publish/verify an appropriate record; SPF/DKIM verification is not evidence that DMARC exists. |
| Email studio | PARTIAL | Activity, template iframe previews, manual retries and support resolution exist. No dedicated safe “send selected template to an allowlisted test recipient” action was found. |

`KAPO_EMAIL_FROM` is read by configuration but production notifications pass `sender("orders")`; sender addresses are hardcoded in `lib/email/addresses.ts`. Changing that variable alone does not change outgoing order mail.

### 5. Newsletter and marketing

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Explicit consent and double opt-in | PARTIAL integration; WORKING policy helper | Checkbox, consent/source timestamps, hashed confirmation token and pending→confirmed flow exist. Tests verify consent state decisions. No signup email or persistent end-to-end signup was performed. |
| Subscriber storage, preference and unsubscribe routes | UNVERIFIED end to end | Tables and token-based handlers exist, including unsubscribe GET/POST and topic/frequency preferences. They were not exercised with a subscriber. |
| Campaign editor, previews, scheduling and dashboard | PARTIAL | Source implements these features. Cron endpoint exists, but no deployed scheduler invocation is configured in `vercel.json` or the Worker entry point. External scheduling is unverified. |
| Campaign delivery reporting/retry | BROKEN | Synthetic all-recipient failure still marks campaign sent and returns success; see F07. |
| YouTube ingestion | PARTIAL / security gap | Subscribe action, challenge and feed parser exist. Local channel/hub settings are absent; POST verifies no signature or callback token. No lease renewal job found. |
| Instagram automation | MISSING automatic ingestion | Manual Instagram announcement intake exists; no Instagram webhook, polling integration, or automatic feed ingestion found. |
| Product launches/restocks/price-drop drafts | PARTIAL | Event engine, dedupe rules, digest and announcement templates exist. Macropad save calls the engine. Static keycap catalog has no general product editor/update hook; an admin can announce manually. |
| Commercial-mail readiness | PARTIAL / BLOCKED for campaigns | Local mailing-address setting is absent. Campaign sender blocks missing address; signup/preference mail still has placeholder address fallback. Content classification and legal review remain to be finalized. |

### 6. Customer authentication and authorization

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Email-owned account identity | BROKEN | Entering name and arbitrary email can issue a signed account cookie when a session secret is available. No OTP/magic-link proof exists. Synthetic identity passed order authorization. F01. |
| Session integrity | PARTIAL | HMAC signing, HttpOnly and SameSite=Lax exist. Cookie is signed/base64-encoded, not encrypted. Payload has no server-checked expiry or revocation. Browser Max-Age alone does not invalidate a replayed token. |
| Production local-session setup | MISSING locally / UNVERIFIED remotely | `KAPO_SESSION_SECRET` absent from both inspected env files and from `.env.example`. Production code refuses local account cookies without it. Adding it alone would expose F01. |
| Customer history and per-order authorization | PARTIAL | Routes query/filter matching user/email. Helper isolation tests pass for trusted identities, but that prerequisite fails in F01/F02. |
| ChatGPT header identity | BROKEN outside a trusted header-stripping gateway | Arbitrary incoming identity headers are accepted in local production. No signature or deployment trust check exists in app code. F02. |
| Passwordless login | MISSING verified challenge flow | A sign-in email template in the studio is not an OTP issuer/verifier or single-use magic-link implementation. |

### 7. Admin

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Admin allowlist policy | WORKING helper; PARTIAL complete access control | Tests verify email allowlisting. Page/API gates exist. Identity source is unsafe on standalone hosting; admin allowlist is absent locally and dev bypass is enabled locally. |
| Public-host admin sign-in | BROKEN in reproduced Vercel-style local runtime | `/signin-with-chatgpt?return_to=%2Fadmin` returned 404. README explains that Sites Dispatch owns this route; standalone Next/Vercel has no such service configured in the inspected files. |
| Orders, production queues, detail and shipping controls | PARTIAL / UNVERIFIED with actual orders | Substantial pages/editor/API implemented. No orders existed in inspected local stores; Vercel database adapter blocks the workflow. |
| Products/pricing/inventory | PARTIAL | Only macropad launch/price/inventory control is implemented. Keycaps and their prices are static catalog code. Finite macropad stock is checked per cart but never atomically reserved/decremented. |
| Customer management | MISSING dedicated management UI | Customer details appear on orders. No customer CRUD/export/search management subsystem found beyond order search. |
| Promotions | PARTIAL | Environment discount parser and marketing announcement editor exist; no commerce discount dashboard. |
| Analytics and finance | PARTIAL; one reproduced reporting bug | Order metrics exist, but “net revenue after tax” includes tax. “Profit” excludes goods, labor, Stripe fees and packaging costs. No storefront analytics events found. |
| Roles and permissions | PARTIAL | Single admin email allowlist; no separate fulfillment/marketing/read-only roles. Needed only if operations require delegated roles. |

### 8. Support

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Widget, knowledge pack, model client | PARTIAL / UNVERIFIED model response | UI exists and model credential is present. No model call was made because chat persists messages and invokes a paid external API. |
| Knowledge restrictions | PARTIAL | Prompt limits invented store facts and says the bot cannot access orders. Knowledge derives from catalog and policy constants. Restrictions are prompt-based; no adversarial behavior evaluation was run. |
| Access to commerce secrets/actions | WORKING by inspected architecture, not a behavior certification | Model request sends prompt/history and has no tool definitions or order-query tool. No secret is deliberately included in the knowledge pack. This does not establish resistance to every prompt attack. |
| Human escalation | PARTIAL / UNVERIFIED delivery | Validated request, stored transcript, Resend team message and acknowledgment exist. No message was sent. Admin can resolve requests. |
| Abuse/cost limits | PARTIAL | In-memory per-IP limit and persistent support-request count exist. Configured daily chat count/budget/retention settings have no enforcement/cleanup consumers. Messages are stored before the chat rate check. |
| Support inbox | UNVERIFIED | `support@shopkapo.com` is used consistently. Domain verification does not establish that incoming support email is received or staffed. |

### 9. Policies and compliance

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Privacy, terms, shipping/returns, FAQ | WORKING for page delivery; PARTIAL content readiness | Read actual contents; HTTP 200. US-only shipping, 5–10 business-day production, 14-day unused return policy, and refund process are described. |
| Privacy accuracy | BROKEN factual statement | Privacy says session cookie is encrypted; implementation signs a readable base64 payload. Also needs to identify the AI processor for chat content and a concrete retention/deletion practice. |
| Business information | PARTIAL | Brand/support contact exists; no clear legal operator identity, published business mailing address, effective policy date or comprehensive cancellation procedure was found in these pages. Applicability must be assessed for the actual business/jurisdictions. |
| Commercial email | PARTIAL | Explicit opt-in, opt-out endpoints and campaign address gate are implemented. Mailing address, suppression behavior and real preference/unsubscribe delivery still need verification. |
| Tax registrations and applicable sales-tax duties | UNVERIFIED | Cannot be established from source or a disabled tax flag. No legal conclusion about where KAPO must register is made. |
| Product fit / measurements / processing promises | UNVERIFIED operationally | Validate physical products and production capacity before relying on published claims. |

The FTC's business guide requires a valid postal address and a functioning opt-out mechanism for covered commercial mail. This is relevant to marketing launch, not evidence that ordinary transactional receipts need marketing opt-in. [FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).

### 10. Production, database and SEO

| Feature | Status | Evidence / remaining work |
| --- | --- | --- |
| Domain resolution and HTTPS | WORKING at audit time | Public HTTPS GET completed successfully and redirected to www. No certificate-expiry monitoring or DNS dashboard inspection performed. |
| Vercel build | WORKING for compilation | Actual configured Next/webpack build passed. |
| Vercel data access | BROKEN | `next.config.ts` aliases worker env to an empty object; `getDb()` requires `env.DB`. Reproduced unavailable order history in the local Vercel-style production build. |
| Cloudflare D1 implementation | WORKING for local schema; UNVERIFIED remote | Vinext/Worker D1 configuration exists and local SQLite tables exist. No remote database schema, permissions or records were queried. |
| Migration execution process | PARTIAL | SQL is valid on a fresh DB; runtime migrator replays SQL and catches existing-table/column errors. No production release migration command/job is wired into package scripts or Vercel build. Some newsletter/support/launch functions call migration unconditionally, bypassing the commerce `autoMigrate` choice. |
| Backups, restore, monitoring and alerting | UNVERIFIED external setup; MISSING repo runbook | No automated restore test, backup procedure or alert configuration found. Cloud-provider backup capabilities may exist outside this repo. |
| Environment management | PARTIAL | Env example and ignored local files exist. Missing identity/Stripe/admin settings and dual-host mismatch are material. Actual Vercel env inventory unverified. |
| SEO metadata, canonical, robots, sitemap, JSON-LD | WORKING for inspected source/public endpoints; PARTIAL validation | Page metadata and product JSON-LD exist; public robots/sitemap serve 200. Search Console submission, rich-results validation, production revision parity, performance and canonical-host policy were not verified. |
| Analytics | MISSING in inspected application | No event instrumentation or connected analytics implementation found. Vercel dashboard-only analytics may exist externally. |
| Broken links | PARTIAL verification | Ordinary local pages checked successfully. Reserved standalone admin sign-in is 404. Social ownership/accessibility not established by HTTP status. |
| Dependency security and CI quality gates | PARTIAL / failing checks | Dependency scan flags vulnerabilities; lint/tests fail. No `.github` CI workflow directory found. External CI may exist. |

## Confirmed failures and security findings

### F01 — P0: Unverified email can become an order-viewing identity — BROKEN

Files: `app/api/account/session/route.ts:7`, `lib/commerce/local-session.ts:41`, `lib/commerce/authz.ts`, `lib/commerce/store.ts` (`listCustomerOrders`, `getCustomerOrder`).

`sealLocalUser` signs a supplied name/email after syntax checks. There is no inbox challenge. Authorization accepts the resulting email as ownership of matching orders. An isolated call with a synthetic victim address issued a token, and `customerCanViewOrder` accepted that identity for a different customer's matching-email order.

Impact: when local sessions are enabled and a database is reachable, knowledge of a customer's email can expose their order history. This audit did not access any real customer's account. Production currently lacks a usable tested database; that does not make this identity design safe to enable later.

Change: use verified, expiring, single-use passwordless identity or a trusted authentication provider; enforce ownership from verified claims. Add server-validated session expiry/revocation. Complexity: **L**.

### F02 — P0: Incoming identity headers are trusted without verification — BROKEN in standalone runtime

Files: `app/chatgpt-auth.ts:22`, `app/admin-auth.ts:7`, `README.md` auth assumptions, `vercel.json`.

An isolated `getChatGPTUser` call accepted arbitrary synthetic headers. A GET to the locally built production Next server with synthetic `oai-authenticated-user-id` / `oai-authenticated-user-email` headers returned the signed-in account UI and reflected that synthetic email. No external proxy or production endpoint was attacked.

Impact: on a directly reachable deployment that forwards those headers, customer identity is spoofable. If `KAPO_ADMIN_EMAILS` is populated, the same identity source can satisfy admin gates by claiming an allowed address. A Sites gateway may safely strip/reinject identity, but that trust boundary must be enforced and cannot be assumed on Vercel.

Change: authenticate signed server sessions and explicitly restrict any header-based identity to a verified gateway. Test the direct deployment/origin as well as the custom domain. Complexity: **M–L**.

### F03 — P0: Current Vercel build cannot access the order database — BROKEN

Files: `next.config.ts:22`, `lib/cloudflare-workers-stub.ts`, `db/index.ts:5`, `lib/workers-env.ts`, `vercel.json`.

The Vercel-specific alias imports `env = {}`. `getDb()` requires a real `env.DB` Cloudflare D1 binding and throws without it. No Vercel database adapter or remote D1 bridge exists. The Next build passes, while synthetic signed-in order history renders “Orders cannot be loaded right now.”

Impact: database-backed quoting, orders, webhook persistence, subscriber/support records and admin operations cannot work on this build merely by setting payment keys. Pages can conceal this by catching errors or falling back to default macropad state.

Change: choose the actual production runtime; provide a supported database connection there, apply migrations explicitly, and probe database readiness before enabling sales. Complexity: **L** if retaining Vercel, **M** for a verified existing D1-capable hosting path; deployment/access details remain unknown.

### F04 — P0: Stripe is not configured for the inspected checkout — BLOCKED / UNVERIFIED payment integration

Files: `app/api/checkout/config/route.ts`, `lib/commerce/env.ts`, `app/api/webhooks/stripe/route.ts`, deployment environment.

Both local and public GET `/api/checkout/config` return no publishable key and “Stripe is not configured yet.” Local env files lack `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` and `STRIPE_WEBHOOK_SECRET`. Production key inventory is not available; its public response confirms no usable checkout configuration.

Change: after F01–F03, configure a test environment and webhook endpoint, run the complete sale/refund journey, verify tax settings, then configure separately verified production credentials. Complexity: **M**, excluding business/account setup.

### F05 — P1: Late tracking events regress delivered shipping state — BROKEN

Files: `lib/commerce/status.ts:60`, `lib/commerce/store.ts:587`.

Reproduction: `applyTrackingStatus("delivered", "delivered", "TRANSIT")` returns shipping `in_transit` with a `tracking_update` email. The ingestion path does not compare event time with the last applied shipment event. Production state can remain delivered while shipping regresses.

Change: enforce event ordering and supported terminal-state transitions while allowing legitimate return/exception flows. Complexity: **M**.

### F06 — P0: Tracking retry can permanently skip order updates or email — BROKEN under injected database failure

File: `lib/commerce/store.ts:587` (`applyTracking`).

The handler inserts a uniquely keyed tracking event before updating the order and writing notification work. If a later operation fails, the outer webhook is retryable, but replay hits the tracking-event unique constraint and returns immediately. An isolated source-function test injected a notification persistence failure after event insertion: the first attempt reached notification, the retry did not. Expected two attempts; observed one.

Impact: a transient database error can permanently lose a shipment/delivery notification or downstream state work despite provider retry.

Change: commit event/state/outbox atomically, or persist per-event progress and resume unfinished side effects. Complexity: **L**.

### F07 — P1: Campaign reports success even when every recipient send fails — BROKEN

File: `lib/email/newsletter.ts:152` (`sendCampaign`, especially lines 220–227).

An isolated source-function test supplied one eligible synthetic recipient and made `sendOneCampaign` return false. The function still set campaign status `sent`, marked announcements sent, and returned `ok: true`. A later send is then blocked as already sent.

Change: aggregate per-recipient outcomes, retain retryable partial/failed state, and atomically claim campaign work before sending. Broadcast creation also needs a durable attempt/idempotency strategy. Complexity: **M**.

### F08 — P1: Standard build/test scripts fail on Windows; rendered tests target deleted starter — BROKEN

Files: `package.json` (`dev`, `build`, `start`, `test`), `tests/rendered-html.test.mjs`.

`npm run build` and `npm test` fail at the environment assignment. Running the builder directly succeeds. Direct rendered tests fail on unsupported `cloudflare:` ESM import and missing `app/_sites-preview/SkeletonPreview.tsx`; assertions still expect “Your site is taking shape.” These are test/script defects, not evidence that the KAPO homepage fails to render.

Change: portable scripts and runtime-appropriate storefront smoke/integration tests. Complexity: **S–M**.

### F09 — P1: Lint fails — BROKEN quality gate

Files / errors:

- `app/newsletter/preferences/page.tsx:15`: unescaped apostrophe.
- `app/page.tsx:330`, `:413`: ref-use rule failures in carousel handler construction.
- `components/CharacterProduct.tsx:22`, `components/SiteChrome.tsx:37`, `components/SupportChat.tsx:96`, `:106`: state-in-effect rule failures.
- `components/PreferenceCenter.tsx:71`: label association/text error.
- `components/SiteChrome.tsx:180`: two noninteractive click/keyboard accessibility errors.
- `lib/email/newsletter.ts:456`: unused `loadDraft`.

51 warnings also remain, predominantly image optimization and related code-quality issues. A lint error is not, by itself, a reproduced shopper-visible crash. Complexity: **S–M**.

### F10 — P1: Stripe live-mode safeguard misses restricted live keys — BROKEN helper

File: `lib/commerce/authz.ts` (`liveModeBlocked`), callers in `lib/commerce/store.ts` and `app/api/checkout/config/route.ts`.

The helper only recognizes `sk_live_` as live Stripe credentials. A synthetic `rk_live_` credential passed with `allowLive=false` returned no block. The public-config handler separately checks a live publishable key, but direct checkout-session creation only applies the secret-key guard. No live request was made.

Change: explicitly classify supported key types and reject unknown/mismatched modes on all mutation paths; review refunds for equivalent intended environment protection. Complexity: **S**.

### F11 — P1: Dashboard's after-tax net revenue includes tax — BROKEN reporting

Files: `lib/commerce/status.ts` (`summarizeFinance`), `app/admin/page.tsx`.

Dashboard labels net revenue “After refunds and tax.” A synthetic paid total of 1,100 cents with 100 cents tax and no refund produced net revenue 1,100 cents, not 1,000. The separate profit calculation subtracts tax but omits product costs, payment fees, labor and packaging.

Change: align arithmetic and labels; name contribution estimates accurately or add required cost inputs. Complexity: **S–M**.

### F12 — P0: Order/webhook/email recovery is incomplete — PARTIAL; source-identified risks

File: `lib/commerce/store.ts` (`createCheckout`, `settleCheckoutSession`, `applyRefund`, `notify`, `claimWebhook`).

- Order, line items, payment and shipment are inserted sequentially without a shared transaction/batch. Failure after order insertion leaves a pending order; retry follows the existing-order branch and does not recreate missing related records.
- A paid order update occurs before its payment-row/event writes. If later persistence fails, retry sees the paid order and sends payment emails, but does not repair every skipped payment/event write.
- Refund persistence precedes refund notification. Concurrent or reversed snapshots are not guarded by an atomic compare-and-set, despite the monotonic helper test.
- `notify` sends externally before saving its notification row. Provider success followed by a database failure creates an uncertain outcome. Resend idempotency helps only within its retention window; it is not a permanent outbox.
- Reclaiming failed/stale webhook processing uses a read-then-update instead of an atomic lease claim. Multiple retry workers can both acquire the same work.

These are source-supported failure windows, not claims that duplicate charges/emails have already occurred. Unique indexes and provider idempotency provide meaningful protection, but do not prove a complete, exactly-once order journey. Add injected-failure/concurrency tests before trusting these paths.

Change: transactional order assembly, atomic event claims, resumable reconciliation and durable notification outbox. Complexity: **L**.

Resend documents a 24-hour idempotency retention window. [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

### F13 — P1: Pending label voids cannot complete locally — PARTIAL

Files: `lib/commerce/store.ts:895`, `applyShippoWebhook`, `rememberTransaction`; `lib/commerce/shippo.ts`, `lib/commerce/status.ts`.

QUEUED/PENDING refunds set `void_requested`; active-label policy and unique index block another purchase. No scheduled refund-status reconciliation or handler changes this to voided/rejected after an asynchronous provider result. The clear-attempt action only handles pending/uncertain purchases, not `void_requested`.

Change: persist refund identifier and reconcile authoritative status, failed refunds, spending holds and replacement eligibility. Complexity: **M**.

### F14 — P1: YouTube POST can be forged — PARTIAL security

Files: `app/api/webhooks/youtube/route.ts`, `lib/email/youtube.ts`, `lib/email/engine.ts`.

GET challenge checks a hub token. POST only parses XML and compares the public channel ID; it authenticates neither body nor sender. The parser accepts an alternate link from the payload. If channel ingestion is enabled, a crafted request can create a store announcement containing attacker-selected content/link; whether it sends immediately depends on configured automation mode. Currently local channel settings are absent. No forged webhook was submitted.

Change: authenticated feed ingestion or re-fetch/validate authoritative channel/video content before accepting it; restrict expected link hosts. Add lease renewal. Complexity: **M**. Resolve before enabling social automation.

### F15 — P1: Support budget and retention controls are configuration-only — PARTIAL

Files: `lib/support/config.ts`, `app/api/support/chat/route.ts`, `lib/support/store.ts`.

`dailyRequests`, `dailyBudgetUsd`, and `retentionMs` are defined but have no enforcement/cleanup consumer. IP limits live in a process-local Map, reset with instances, and the user message is persisted before the rate check. Do not claim a daily budget or automatic message expiry from those settings.

Change: durable counters/budget policy, request/body limits, enforcement before persistence/provider calls, and a retention/deletion job. Complexity: **M**.

### F16 — P1: Privacy description disagrees with session implementation — BROKEN factual claim / PARTIAL disclosure

Files: `app/privacy/page.tsx`, `lib/commerce/local-session.ts`, `lib/support/store.ts`, `app/api/support/chat/route.ts`.

The cookie is HMAC-signed readable JSON, not encrypted. Chat history is sent to OpenRouter/model processing, but the policy does not identify that processing relationship. No support-retention cleanup was found. Update policy after the identity/retention design is finalized. Complexity: **S–M**, plus owner/legal review as applicable.

### F17 — P0 dependency review: scanner flags critical/high packages — VERIFIED scanner finding; exploitability UNVERIFIED

Files: `package.json`, `package-lock.json`.

Production dependency scan reports `next` critical; `nanoid`, `postcss`, `sharp`, `source-map-js` high; `baseline-browser-mapping` moderate. Installed Next is 16.2.6. The scanner lists, among others, Windows-hosted server RCE and image-processing advisories. Some findings require particular hosting/API/input conditions that this site may not expose. This audit did not attempt exploitation or prove those conditions in production.

Change: review current maintainer advisories, update compatible affected packages, rerun both build paths and the acceptance suite, and document any remaining non-applicable findings. Do not run an unreviewed forced dependency upgrade. Complexity: **M** initially, **L** if runtime compatibility requires migration.

Representative scanner references: [Next Windows-host advisory](https://github.com/advisories/GHSA-p293-qw3h-jr36), [Next image advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4), [PostCSS advisory](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). Advisory status changes over time; rerun the scan when implementing.

## Environment audit — names only

These are local-file observations, not a dump of production settings or secret values.

| Variable name(s) | Observation / risk |
| --- | --- |
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` | Absent from both local env files. Public and local checkout have no usable configuration. |
| `KAPO_SESSION_SECRET` | Absent from both local files and `.env.example`; production local-session functions require it. Fix F01 before enabling. |
| `KAPO_ADMIN_EMAILS` | Absent locally; production allowlist must be established with trustworthy identity. |
| `KAPO_ADMIN_DEV_BYPASS` | Enabled in local files; intentionally ignored by the code when `NODE_ENV` is production. Never rely on it for public-host admin access. Verify actual worker/runtime environment behavior. |
| `KAPO_ALLOW_LIVE_PAYMENTS`, `KAPO_ALLOW_LIVE_LABELS` | Disabled locally. Correct for audit/testing; not evidence of production readiness. |
| `SHIPPO_MODE`, `SHIPPO_TEST_API_KEY`, `SHIPPO_API_TOKEN`, `SHIPPO_LIVE_API_KEY` | Present; test access was verified using the test key. Live-key validity was not tested. Maintain strict mode separation and review F10. |
| `SHIPPO_WEBHOOK_TOKEN` | Present. Actual provider callback registration and token match unverified. Protect from URL/request logs. |
| `SHIPPO_WEBHOOK_SECRET` | Absent locally. Not automatically a defect: token verification is implemented and Shippo documents tokens as a supported security option. HMAC requires provider-side setup. |
| `KAPO_SHIPPO_ENFORCE_IP_ALLOWLIST` | Optional. Depends on a trusted source-IP header; do not enable blindly on a host that does not supply it. |
| `KAPO_SHIPPING_ORIGIN` | Present with required origin fields; physical correctness and carrier acceptance unverified. No address is reproduced here. |
| `KAPO_PARCEL_LENGTH_IN`, `KAPO_PARCEL_WIDTH_IN`, `KAPO_PARCEL_HEIGHT_IN`, `KAPO_PACKAGING_WEIGHT_GRAMS` | Code defaults are used when absent; measure actual parcels. |
| `STRIPE_TAX_ENABLED` | Defaults disabled; tax registration/setup unverified. |
| `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `KAPO_RESEND_AUDIENCE_ID` | Present. Read-only domain API access verified; audience/webhook setup and delivery unverified. |
| `KAPO_EMAIL_FROM` | Present but order notifications use hardcoded sender helper. Configuration is misleading until aligned. |
| `KAPO_PUBLIC_SITE_URL` | Present; verify canonical production host and all emailed links on the chosen deployment. |
| `KAPO_MAILING_ADDRESS` | Absent locally. Campaigns are blocked by code until provided. |
| `KAPO_CRON_SECRET` | Absent locally. Cron endpoint cannot authorize runs without it; deployed scheduler is also unverified. |
| `KAPO_YOUTUBE_CHANNEL_ID`, `KAPO_YOUTUBE_HUB_TOKEN` | Absent locally. Automatic YouTube intake not configured. |
| `KAPO_RESEND_TOPIC_PRODUCTS`, `KAPO_RESEND_TOPIC_DEALS`, `KAPO_RESEND_TOPIC_YOUTUBE`, `KAPO_RESEND_TOPIC_INSTAGRAM`, `KAPO_RESEND_TOPIC_NEWS` | Absent locally. Direct local filtering remains possible; topic-based broadcast setup is unverified. |
| `SENDBLUE_API_KEY`, `SENDBLUE_API_SECRET`, `SENDBLUE_FROM_NUMBER` | Absent locally, while checkout offers optional text updates. Hide/qualify opt-in or configure and verify before promising texts. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME` | Present. No model call or model availability check performed. |
| `KAPO_AUTO_MIGRATE` | Supported in commerce configuration but omitted from env example; other subsystems call migration unconditionally. Use an explicit deployment migration strategy. |

`.env.local` and `.dev.vars` are ignored by Git; no secret values were printed or copied into this report. This is not a Git-history secret scan.

Shippo supports URL tokens and optional HMAC; missing HMAC alone is not proof that callbacks are insecure. [Shippo webhook security](https://docs.goshippo.com/tracking/webhook-security).

## Prioritized implementation queue

Complexity: **S** roughly hours–1 day; **M** roughly 1–3 engineering days; **L** several days or more. These are planning ranges, not commitments; external account approvals and unavailable deployment access are excluded.

### P0 — before taking orders

| Order | Task | Specific files / configuration | Complexity | Acceptance evidence |
| --- | --- | --- | --- | --- |
| 1 | Replace unverified email/header identity; establish real admin sign-in | `app/chatgpt-auth.ts`, `app/admin-auth.ts`, `app/api/account/session/route.ts`, `lib/commerce/local-session.ts`, `lib/commerce/authz.ts`, `components/AccountSignIn.tsx`, `.env.example` | L | Email ownership challenge, expiry/replay tests, cross-customer denial, forged-header denial, admin on actual host. |
| 2 | Choose production runtime and connect durable database; migrate explicitly | `next.config.ts`, `lib/cloudflare-workers-stub.ts`, `db/index.ts`, `db/migrate.ts`, `vite.config.ts`, `worker/index.ts`, `vercel.json`, deployment secrets | M–L | Deployed database health and schema checks; no request-time schema mutation requirement; restore rehearsal. |
| 3 | Resolve dependency security findings applicable to selected runtime | `package.json`, `package-lock.json` | M–L | Updated advisory scan and both relevant build/integration checks. |
| 4 | Complete order assembly and event/outbox recovery | `lib/commerce/store.ts`, `db/schema.ts`, new migration as needed | L | Failure injection after each write, simultaneous checkout/webhook delivery, one complete order, no lost required notification. |
| 5 | Configure Stripe test keys/webhooks and prove payment/totals/refund | `.env.example`, deployment env, `app/api/checkout/*`, `app/api/webhooks/stripe/route.ts`, `lib/commerce/store.ts`, `components/CheckoutExperience.tsx` | M | Test success/decline/async flows, exact totals, tax account verification, no double charge/order. |
| 6 | Prove Shippo rates → admin test label → handoff/tracking | `lib/commerce/shippo.ts`, `lib/commerce/store.ts`, `app/api/webhooks/shippo/route.ts`, `components/AdminOrderEditor.tsx`, shipping origin/parcel settings | M | Isolated test-mode label, actual PDF/tracking, explicit mode safeguards, measured parcels and correct charges. This audit did not authorize/perform those external writes. |
| 7 | Prove transactional delivery/retry and operational reconciliation | `lib/commerce/store.ts`, `lib/commerce/email.ts`, `lib/email/client.ts`, `app/api/webhooks/resend/route.ts`, `app/admin/email/page.tsx` | M–L | Controlled inbox receives correct messages; provider retry and storage failure cannot silently lose them; admin can recover. |
| 8 | Complete deployed desktop/mobile acceptance and production checks | `vercel.json` or selected Worker deployment, deployment env, `README.md`, acceptance tests | M | Known deployed revision; configured production webhooks; verified HTTPS, database, admin access, backup/restore and full customer journey before orders open. |

P0 release gates include tax/business setup appropriate to the business and accurate published policies. Automation for every policy process is not required, but the process must actually be executable by the operator.

### P1 — launch professionally

| Task | Files / configuration | Complexity |
| --- | --- | --- |
| Fix delivered tracking regression, pending void reconciliation and restricted live-key classification | `lib/commerce/status.ts`, `lib/commerce/store.ts`, `lib/commerce/shippo.ts`, `lib/commerce/authz.ts` | M |
| Implement cancellation state/action and canceled-email trigger; decide partial-refund UI | `lib/commerce/status.ts`, `store.ts`, `db/schema.ts`, `app/api/admin/orders/[orderId]/route.ts`, `components/AdminOrderEditor.tsx` | M |
| Replace starter tests, repair portable scripts and lint; add CI | `package.json`, `tests/rendered-html.test.mjs`, files in F09, new CI config | M |
| Correct finance labels/arithmetic and unsupported text-update promise | `lib/commerce/status.ts`, `app/admin/page.tsx`, `components/CheckoutExperience.tsx`, `lib/commerce/sendblue.ts` | S–M |
| Add DMARC; verify incoming support mailbox and email-client layouts | DNS, `lib/email/design.ts`, `messages.ts`, `lib/commerce/email-template.ts` | S–M |
| Finalize privacy/business/policy copy with actual practices and measurements | `app/privacy/page.tsx`, `app/terms/page.tsx`, `app/shipping-returns/page.tsx`, `components/CharacterProduct.tsx`, `lib/store-facts.ts` | S–M |
| Repair campaign failure/retry state, provide mailing address, verify consent/unsubscribe suppression before marketing | `lib/email/newsletter.ts`, `policy.ts`, `engine.ts`, admin marketing/email routes, deployment env | M |
| Wire scheduler securely; verify YouTube authenticity/renewal before enabling it | `app/api/cron/newsletter/route.ts`, `app/api/webhooks/youtube/route.ts`, `lib/email/youtube.ts`, `vercel.json` or Worker schedule | M |
| Enforce support limits/retention and evaluate grounded responses | `lib/support/config.ts`, `store.ts`, `prompt.ts`, `app/api/support/chat/route.ts`, cleanup job | M |
| Finish mobile/accessibility, all variant/image QA, rich-results and canonical-host checks | `components/SiteChrome.tsx`, `PreferenceCenter.tsx`, `CharacterProduct.tsx`, `app/storefront.css`, `lib/site-index.ts`, `site-origin.ts` | M |

Marketing-specific P1 items become mandatory before enabling their respective sends/automations, even if the store launches without marketing.

### P2 — after core store launch, or before enabling the relevant future product

| Task | Files / configuration | Complexity |
| --- | --- | --- |
| Add general keycap product/pricing/inventory editor, discount management and customer tools if required | `lib/catalog.ts`, `db/schema.ts`, new admin pages/APIs | L |
| Make finite macropad inventory atomic; persist base/six-key configuration and corresponding pricing before selling custom builds | `components/MacropadBuilder.tsx`, `components/CheckoutExperience.tsx`, `lib/commerce/products.ts`, `store.ts`, `db/schema.ts` | L |
| Add automatic Instagram ingestion if desired | `lib/email/engine.ts`, new verified provider integration | M–L |
| QA/activate repaired KAPO font if still intended | `public/fonts/`, `app/globals.css`, font tooling under `scripts/` | S–M |
| Add storefront funnel analytics/Search Console and tune performance/image payloads | `app/layout.tsx`, commerce components, analytics configuration, `lib/site-index.ts` | M |
| Add delegated admin roles and fuller cost accounting as operations grow | `app/admin-auth.ts`, admin APIs, `db/schema.ts`, `lib/commerce/status.ts` | M–L |

Macropad configuration is currently client-side cart data; shipping quote submission sends product ID/quantity only, and order lines do not preserve the custom build. The current no-sale gate limits immediate exposure, but lifting it requires a separate launch audit.

## Automated customer-journey tests still needed

Use an isolated database and provider test doubles for CI. Use separately authorized Stripe/Shippo test environments and controlled email recipients for provider acceptance; never run this suite against live subscriber lists or live postage by default.

1. **Storefront/browser:** all eight characters × both variants; correct image/price/style; mobile navigation/search/carousels; keyboard-only flow; cart add/merge/change/remove/reload; quantity-limit feedback; no-sale macropad behavior.
2. **Verified identity:** challenge issue/verify/expire/single-use; signed-session tampering/expiry/sign-out; arbitrary email cannot authenticate; untrusted identity headers ignored; guest order linking requires proof; customer A cannot list/open customer B's order.
3. **Admin:** anonymous/non-admin rejected on every admin endpoint; allowlisted verified admin accepted; public-host sign-in works; development bypass ignored in production; direct origin cannot bypass gateway identity.
4. **Shipping:** domestic validation, unsupported countries, ZIP/state mismatches, apartments, no rates, timeout, carrier rejection, non-USD/untracked filtering, quote expiry, rate tampering, IP limit behavior and measured parcel rules.
5. **Checkout:** stale/tampered client prices, unknown product, excessive/duplicate lines, expired quotes, discount bounds; exact merchandise/discount/shipping/tax/total; address changes invalidate quotes or update them safely; open-session reuse/replacement and concurrent starts.
6. **Stripe acceptance:** test success, decline, authentication challenge, async success/failure and redirect cancellation; true final totals; account tax settings; webhook-before-redirect and redirect-before-webhook; confirmation updates after settlement without requiring shoppers to guess whether to refresh.
7. **Payment events:** valid/invalid/stale signatures; same event replay, different events for the same session, simultaneous delivery, timeout/restart and out-of-order refund; exactly one complete order and correct payment row; no pending-order record missing items/payment/shipment after a retried failure.
8. **Refund/cancel:** full/partial/repeated/concurrent refunds; provider refusal/pending/failure; monotonic amounts; cancellation before/after fulfillment; stop production appropriately; correct notification and operator audit trail.
9. **Fulfillment:** unpaid order blocked; refreshed final parcel required; explicit price/carrier confirmation; caps and concurrent budget reservation; one active label; provider timeout/uncertain result; recovery without double purchase; label PDF/tracking; purchased label does not imply shipped; handoff transition.
10. **Tracking/void:** event authenticity and duplicates; PRE_TRANSIT→TRANSIT→out-for-delivery→DELIVERED; old TRANSIT cannot regress delivery; failure after event insert resumes work; asynchronous label refund success/rejection; spend-hold reconciliation and replacement eligibility.
11. **Transactional mail:** every supported template with missing/optional fields and escaping; amounts/links/tracking consistent; controlled inbox delivery; attachment/remote-image behavior; retries/429/5xx/timeouts; storage failure after provider acceptance; concurrent triggers and replay beyond provider idempotency retention; bounce/delivery events do not create resend loops.
12. **Newsletter:** unchecked consent rejected; pending cannot receive campaigns; duplicate signup and confirmation; expired/replayed token policy; unsubscribe GET/one-click POST; preferences; rejoin; immediate unsubscribe respected during queued/broadcast sending; persistent provider sync failure recoverable.
13. **Campaigns/social:** manual/scheduled/digest; routine cap/topic/frequency; all/partial recipient failures; retry only unsent recipients; concurrent cron runs; broadcast crash/retry; authenticated YouTube ingestion and renewal; duplicate video/post; manual Instagram; product launch/price-drop thresholds.
14. **Support/privacy:** validated sessions/transcripts, no cross-conversation access, bounded payloads, durable per-user/IP/budget enforcement, prompt-injection/unknown-policy responses, no invented actions, human acknowledgment only after actual send, retry dedupe, retention/deletion.
15. **Release/operations:** fresh and upgrade migrations on the actual target database; both selected runtime build and production-start smoke; secrets present by name without logging values; deployed database readiness; HTTPS/custom-domain routing; real admin auth; backup restore; sitemap/robots/canonical/product metadata; mobile journey and error monitoring.

## Recommended next implementation sequence

1. Resolve identity trust and the Vercel/D1 runtime mismatch before exposing order data or enabling payment.
2. Triage dependency advisories, repair test infrastructure, and add atomic order/event/outbox recovery with meaningful failure tests.
3. Configure Stripe sandbox/test credentials and prove the priced checkout, settlement, decline and refund flow against the chosen database.
4. Prove Shippo quote and fulfillment in test mode with measured packaging, then fix tracking/void recovery.
5. Verify controlled transactional-email delivery and recovery, correct policy text, and operator/admin access.
6. Deploy a known revision and complete desktop/mobile acceptance and operational checks. Enable live commerce only after those pass.
7. Enable newsletter/social automation after its independent consent, address, suppression, scheduler and failure-retry gates pass.

No launch-readiness percentage is assigned: passed UI/helper checks cannot compensate for a missing production database, unverified identity, or blocked payment configuration.
