# KAPO Club implementation and production readiness

October 18, 2026. This report supersedes the account-related implementation findings in the earlier launch audit; it does not certify the rest of the store for launch.

## Result

**Implemented and verified locally. Not deployed or activated for live commerce.** KAPO Club now has verified customer identity, persistent sessions, account/profile pages, order ownership, wishlist, preferences, a durable rewards ledger, redemption reservations, checkout integration and administrator adjustment controls.

The selected production architecture is **Cloudflare Workers/vinext + the existing D1 database + the existing KAPO Keycaps Clerk application**. See `KAPO_CLUB_ARCHITECTURE.md` for the plan, approval boundary and rollback approach. No production database/provider/domain migration was performed.

The current public Vercel deployment still needs a supported database/runtime decision and deployment approval. Its old D1 stub is deliberately not repurposed as a loyalty database. Missing D1 access fails closed; balances are never invented or stored in browser storage.

## What changed

### Identity and account security

- Replaced the name/email cookie login. `/api/account/session` now returns 410 and issues no account cookie.
- Incoming `oai-*` and `x-clerk-*` identity claims are not trusted. Compatibility helpers in `app/chatgpt-auth.ts` now call the verified Clerk identity implementation.
- Clerk Backend SDK verifies a session JWT and its authorized party. The server then checks the authoritative session is active/unexpired and that the authoritative primary email is verified. Banned/locked users, missing configuration, invalid tokens and provider failures deny access.
- Browser session renewal and sign-in/account-recovery UI use Clerk. Account sign-out ends the provider session. The server sign-out endpoint also supports authoritative revocation.
- Admin uses the same verified identity plus `KAPO_ADMIN_EMAILS`; the previous development admin bypass no longer grants access to admin routes.
- Added origin checks to Club and existing admin mutation endpoints. Private Club responses are `private, no-store`.
- Customer order reads require the immutable account ID. Merely sharing an order's email does not authorize reads. Explicit guest-order claim requires that email to be verified and only attaches unowned or legacy anonymous-cookie orders; another verified account's orders cannot be claimed.
- The old legacy cookies are not imported or promoted into verified sessions.

Implementation: `lib/auth/server.ts`, `lib/auth/policy.ts`, `app/chatgpt-auth.ts`, `app/admin-auth.ts`, `app/sign-in/page.tsx`, `app/sign-up/page.tsx`, `components/ClubAuthProvider.tsx`, `components/ClubSignIn.tsx`, account API routes and `lib/commerce/authz.ts`.

### Customer experience

- Personalized overview with points/progress, recent orders, wishlist and existing character renders.
- Orders tab with owned order cards, status, details and tracking links where available; explicit guest-order linking.
- Persistent per-account wishlist with real character/variant IDs, product-page save/remove control and saved-state lookup.
- Rewards tab with point history, account-bound reservation links and release of unused unbound rewards.
- Profile name editing and optional order-progress email settings. Essential order/refund messages remain enabled.
- Newsletter status, explicit subscription consent, existing confirmation flow, topic/frequency preferences and unsubscribe. Membership itself never subscribes a customer; subscribers can still use existing newsletter flows without a Club account.
- Desktop and mobile layouts retain Fredoka, the current KAPO wordmark/assets and the existing storefront shell. Mobile navigation scrolls and security/sign-out controls remain accessible through Settings.
- A development-only `?preview=1` view uses visibly labeled fictional data and cannot mutate accounts. It grants no authentication and is ignored in production.

Implementation: `components/ClubAccount.tsx`, `app/club.css`, `app/account/page.tsx`, `components/WishlistButton.tsx`, `app/api/club/*` and `components/CharacterProduct.tsx`.

### Rewards accounting

Default policy is configurable by server environment:

| Rule | Initial value |
| --- | --- |
| Earn | 10 points per eligible merchandise dollar, rounded down |
| Value | 100 points = $1 off merchandise |
| Minimum reservation | 300 points ($3) |
| Minimum merchandise subtotal | $10, chosen as a configurable initial restriction |
| Verified signup | 50 points, once per Clerk subject |
| First qualifying fulfilled order | 100 bonus points, once per subject |
| Birthday/review/social-follow bonuses | Not enabled |

Orders qualify only after confirmed payment and shipped/in-transit/delivered fulfillment. Shipping, tax and all discounts are excluded from the spend basis. Rules/basis are captured per qualifying order so later product/order/policy edits cannot repeatedly award more points. Orders created before membership do not automatically receive historical rewards.

`club_ledger` is immutable: database triggers prohibit UPDATE/DELETE and maintain the wallet projection. Unique event references deduplicate signup, fulfilled purchases, bonuses, reversals, redemptions and adjustments. Customers have no balance-edit endpoint.

Reservations atomically insert the hold and debit points in one D1 batch; insufficient balance aborts the whole transaction. Holds are bound to one account/order, have a server-checked value and merchandise minimum, and cannot stack with promo codes. Unbound holds expire after 30 minutes. Once bound to a potentially payable Stripe session, a hold is not released merely because time passed. It is spent on verified payment or released on authoritative unpaid failure/expiry for the current session.

Checkout uses a per-quote database lease, stable order identity and atomic related order inserts. Stripe settlement/expiry processing shares the quote lease. An old session's expiry cannot release a reward while a replacement session is opening. Provider requests are bounded; failed work can be retried. Final Stripe merchandise/discount/shipping/tax/total is validated before returning a client secret.

Refunds reverse the cumulative earned-points amount without duplicate reversals. Because the current commerce model lacks itemized refund allocation, the implementation conservatively subtracts refund cents from eligible merchandise first. The first-order bonus reverses if all eligible merchandise is refunded, including when shipping is retained. Spent redemption points are restored proportionally to the cash refund, capped at the original redeemed points; full refunds restore all. Refunds can leave a negative balance if points were already used, and further redemption is blocked until earnings cover it. Points cannot be converted into cash.

Administrator adjustments are bounded, require a reason, record the verified actor, and are idempotent by request ID. They cannot silently overwrite history or debit an account below its available balance. Refund reconciliation uses the order path rather than editing ledger entries.

Implementation: `db/club-schema.ts`, migrations `0005_exotic_true_believers.sql` / `0006_familiar_secret_warriors.sql`, `lib/club/database.ts`, `policy.ts`, `store.ts`, `server.ts`, `lib/commerce/store.ts`, `components/CheckoutExperience.tsx`, `app/api/checkout/session/route.ts`.

### Admin and supporting changes

- Added `/admin/rewards`, customer lookup, ledger inspection and audited adjustment form/API.
- Added KAPO Club to the existing admin navigation.
- Fixed the restricted-live-Stripe-key classification gap.
- Protected delivered shipments from regressing on late transit updates. Tracking retries continue unfinished work instead of immediately returning after an existing tracking-event insert.
- Made refund snapshots monotonic in database writes, and linked payment/fulfillment/refund events to the Club reconciler.
- Production request handling no longer runs the legacy schema migrator. Club tables are never created from account requests.
- Made dev/build/start scripts portable on Windows and updated `npm test` to run meaningful commerce/email/Club tests. The old starter-only rendered test file remains outside the default suite; it is not claimed as a passing storefront integration test.
- Corrected privacy/account terms to describe verified sessions, account ownership and chat processing rather than the old readable cookie as “encrypted.” This is not a comprehensive legal-policy review.

## Verification performed

| Check | Result | Limits |
| --- | --- | --- |
| Commerce/email suite | 33/33 pass | Existing helper/template/mock-client coverage, not external payment acceptance. |
| Club suite | 13/13 pass | Executes actual migrations/triggers/SQL against isolated SQLite databases, including transactions and multiple worker threads. |
| HTTP security suite | 5/5 pass | Against local Worker runtime: legacy login, spoofed identity/token, all admin mutations, cross-origin mutations and private-order denial. |
| Clerk development email-code sign-in | Pass in browser | Uses Clerk's documented `+clerk_test` address and test OTP. No customer inbox or SMS delivery was requested. |
| Signed-in bootstrap | Pass | Real verified development session loaded local D1 profile and awarded exactly 50 signup points. |
| Return visits / reload | Pass | Signed-in account and point balance survived navigation/reload; no repeat signup bonus. |
| Wishlist | Pass in browser | Spore Artisan saved from product page and appeared in account after navigation/reload. |
| Profile/preferences | Pass in browser | Test profile name and optional progress-email checkbox persisted across reload. Newsletter remained unsubscribed. |
| Sign-out | Pass in browser | Provider sign-out returned the page to the membership invitation; private account data disappeared. |
| Provider boundary probe | Pass | Test-only script observed active→revoked provider session and denied requests with missing authorized-party claims/inactive session. It does not substitute for browser login. |
| Mobile | Pass for exercised layouts | 390×844 browser viewport; no document horizontal overflow; nav, welcome, points card and account settings reviewed. Not a real-device certification. |
| Desktop | Pass for exercised layouts | Overview, wishlist, settings and sign-in reviewed in browser. |
| Worker build | Pass | Build after the feature implementation succeeds. |
| Next/Vercel-configured build | Pass for compilation | Still has no usable D1 connection on standalone Vercel; compilation is not deployment readiness. |
| TypeScript | Pass | `npx next typegen` then `npx tsc --noEmit --incremental false`. |
| Focused lint | Pass, no errors in new feature files | Existing repository-wide audit lint issues and image-element warnings are separate. |
| Production migration/deployment/payment/label | Not performed | Requires the approved deployment plan and provider acceptance checks. |

The Club tests cover verified/expired/revoked/unverified identities; cross-customer denial; arithmetic/minimums; signup idempotency; unpaid/unfulfilled orders; duplicate fulfillment and order edits; partial/full refund reversals; redemption debt and proportional restoration; atomic rollback; account/order binding; hold expiry; profile/wishlist isolation; guest claim; administrator adjustment replay; checkout lease release; and genuine simultaneous SQL connections competing for redemption, awarding fulfillment and processing refunds.

Screenshots show the isolated development test account, not a real customer:

- `outputs/kapo-club-overview.jpg` — compact desktop review.
- `outputs/kapo-club-desktop.jpg` — full desktop page.
- `outputs/kapo-club-mobile.jpg` — mobile overview.

## Local development and provider configuration changed

- Linked the **existing KAPO Keycaps development Clerk app**. No second application was provisioned.
- Pulled development keys into ignored local environment files; no credential values belong in this report or committed source.
- Confirmed mandatory email verification and email-code sign-in. Google is enabled in the existing development configuration and is exposed by Clerk's UI; no human Google OAuth flow was completed.
- Set the development maximum session lifetime to **30 days** and made phone/username optional for signup. Existing second-factor capabilities were retained. No production identity configuration was changed.
- Added local authorized origins and a local support-cookie secret. Local Club membership is enabled for testing; redemption is disabled.
- Applied the two additive Club migrations to **local D1 only**, through explicit Wrangler `--local` commands. Existing commerce records were not overwritten/deleted.
- Created the development-only test identity `kapo-club+clerk_test@example.com`; its local profile/50-point welcome entry/wishlist support repeatable checks. Test provider sessions created by the probe were revoked, and the browser test account was signed out. Do not import this fixture into production or grant it administrator access.

## Commands

```powershell
npm run dev
npm test
npm run test:club:http       # requires the local server on localhost:3000
npm run test:club:provider   # explicit dev-only provider probe; requires the isolated fixture
npm run build
npx next typegen
npx tsc --noEmit --incremental false
```

The provider probe never prints JWTs or secret values. It refuses production Clerk keys and a non-fixture identity. HTTP tests refuse remote targets. Unit/concurrency tests use temporary or in-memory databases and clean up only their own temporary directory.

## Remaining production gates

1. **Approve the hosting/release plan.** Retaining Cloudflare D1 means the live application needs a D1-capable Worker runtime. Do not turn on Club or Stripe on the old Vercel D1 stub. No domain cutover/deployment approval is assumed.
2. **Back up and identify the authoritative database.** Confirm existing migration state and apply the new additive migrations exactly once. Earlier project migrations were partly applied by the legacy runtime helper; do not blindly replay every ALTER statement against production. No historical loyalty backfill is authorized.
3. **Configure the production Clerk instance.** The discovered app currently exposes a development instance. Configure production keys, authorized origins, verification, sign-in recovery, Google credentials if desired, session policy and permitted redirect domains. Never publish development keys as a production setup. Verify Clerk origin/handshake behavior on the actual Worker/custom domain.
4. **Configure a verified owner admin allowlist.** No test user was made an administrator. Exercise a real authorized admin's ledger lookup/adjustment and a non-admin denial on staging before relying on admin operations.
5. **Verify Stripe checkout and provider callbacks.** The original Stripe configuration/payment acceptance blockers remain. Exercise reward checkout with a Stripe test session, tax/discount totals, a declined/async payment, session replacement/expiry, duplicate webhooks, a partial/full refund and a fulfilled order on staging. No live key or redemption gate was enabled here.
6. **Verify fulfillment and transactional mail.** Test Shippo label/tracking and controlled inbox delivery; verify optional-vs-essential notifications. The wider audit's postage/refund/email outbox/monitoring issues are not all resolved by this feature.
7. **Review reward economics and customer terms.** Confirm the 10% base future-discount economics, bonuses, $10 minimum, refund policy, negative balances and campaign coexistence against KAPO margins. Publish clear rewards terms before opening redemptions. The code intentionally supports only USD reward orders initially.
8. **Complete operational recovery.** A bound reward whose provider session creation has an uncertain outcome remains held rather than becoming spendable twice. Retry the same quote/idempotent checkout or reconcile the provider session before an operator releases it. A fully automated admin reconciliation UI for every orphaned/uncertain provider session is not claimed. Verify crash/lease expiry/retry recovery on staging.
9. **Finish independent launch blockers.** The current dependency scan still reports six flagged production dependency entries (one critical, four high, one moderate). Those findings, production backups/restore, alerting, outstanding newsletter campaign/void reconciliation issues and broader storefront/mobile checkout acceptance still need their own verification. This change does not silently mark them fixed.
10. **Activate only after acceptance.** `KAPO_CLUB_ENABLED` and `KAPO_REWARDS_REDEMPTION_ENABLED` default off in the example configuration; only local membership was enabled. Keep real payment and redemption off until the complete deployed journey passes. Production migrations and infrastructure/domain changes require explicit approval.

### Known implementation boundaries

- The server uses authoritative Clerk session/user lookups for immediate revocation and verified email. This adds provider latency and denies private access during a provider outage; measure limits/latency before launch.
- Itemized refund allocation is not yet available, so refund point calculations follow the conservative policy described above rather than guessing which tax/shipping/items were refunded.
- Birthday/review incentives, cash conversion, promo stacking and historical rewards backfill are intentionally absent.
- Ledger adjustments are auditable but the dashboard has no automatic cost/margin model. Account deletion, verified email reassignment and retention requests require an operator policy; no production customer records were automatically moved between identities.
- Actual Google sign-in, real-device use, administrative success-path acceptance and Stripe/Shippo/Resend delivery remain externally unverified.

## References

The integration uses [Clerk request authentication](https://clerk.com/docs/reference/backend/authenticate-request), [Clerk development test identities](https://clerk.com/docs/guides/development/testing/test-emails-and-phones), and transactional [D1 batches](https://developers.cloudflare.com/d1/worker-api/d1-database/). Signature/origin checks are not replaced with client-provided identity fields.
