# KAPO storefront and KAPO Club

Next-compatible React storefront running on vinext/Cloudflare Workers with D1 and Drizzle. Clerk handles verified customer identity. Stripe, Shippo and Resend integrations remain subject to the launch acceptance gates.

## Local development

Node 22.13+ is required for the application; the current database tests use the built-in `node:sqlite` API available in Node 22.13+.

```powershell
npm install
npm run dev
npm test
npm run test:club:http
npm run build
npx next typegen
npx tsc --noEmit --incremental false
```

HTTP security tests require the local server. `npm test` runs 33 commerce/email and 13 Club tests against isolated databases/provider doubles. The old starter loading-skeleton tests are not part of this suite.

Copy the variable names in `.env.example` into ignored local environment files. The Worker preview reads `.dev.vars`; Clerk development credentials were also pulled into `.env.local`. Never commit actual secrets. Missing keys disable authentication instead of creating an insecure fallback.

## Customer identity

- Use the existing KAPO Keycaps Clerk application. Browser UI uses `@clerk/react`; server code uses `@clerk/backend` with explicit authorized origins, signature/expiry checks and authoritative active-session/verified-email checks.
- Do not trust `oai-*`, `x-clerk-*`, body email/user ID, or the old `kapo-account` cookie as identity.
- `/sign-in`, `/sign-up`, `/account` and `/account/orders/[orderNumber]` are the customer paths. Sign-in/account recovery use the provider's verified flow.
- Admin requires the same verified identity and `KAPO_ADMIN_EMAILS`. No local admin bypass grants account access.
- Verified users explicitly claim eligible guest orders. A matching email alone does not permit order reads or reassignment of another verified account's orders.
- Membership does not opt a user into the newsletter.

Development Clerk settings were checked and updated for email-code verification, optional signup phone/username, and a 30-day maximum session lifetime. Google is available in the development UI; real Google OAuth and production configuration require acceptance testing.

## Rewards and database

Club data lives only in a real D1 binding. New schema is in `db/club-schema.ts`, with additive migrations `0005_exotic_true_believers.sql` and `0006_familiar_secret_warriors.sql`. Preserve the raw ledger triggers when authoring later migrations.

Migrations must be applied explicitly, not from production requests. The two Club migrations have been applied locally only. The earlier app partly bootstrapped old tables outside the standard migration tracker; identify and baseline the actual remote schema before applying migrations. Do not blindly rerun old ALTER statements or delete production data.

For a local database already containing migrations 0000–0004, after building the Worker and verifying the target binding, the explicit one-time commands used were:

```powershell
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0005_exotic_true_believers.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0006_familiar_secret_warriors.sql
```

Do not repeat CREATE migrations on an already migrated database. No `--remote` migration or deployment is authorized by these examples.

`KAPO_CLUB_ENABLED` and `KAPO_REWARDS_REDEMPTION_ENABLED` default off. Only local membership has been enabled for verification; redemption remains off. Default rules are 10 points/$1 eligible fulfilled merchandise, 100 points/$1 value, 300-point minimum, $10 merchandise minimum, 50 welcome and 100 first-order bonus. All rewards accounting and holds are server-owned and transactional. Birthday/review bonuses and cash conversion are absent.

Per-order reward basis is frozen, event references are unique, the ledger is immutable, and refund adjustments are append-only. Bound reservations must be reconciled against actual provider sessions before release. Checkout and settlement/expiry share a database quote lease.

## Production target and approval boundary

The selected target retains Cloudflare Workers + the existing D1. `.openai/hosting.json`, `vite.config.ts`, `worker/index.ts` and the Sites build integration are preserved. The current standalone Vercel configuration still has an empty worker-environment adapter and cannot operate D1-backed commerce. It is not made production-ready by a successful Next build.

Do not deploy, move DNS, change production identity settings, apply remote migrations/backfills, or enable live rewards/payment before the architecture/release plan is approved and the end-to-end provider journey passes.

Read:

- `KAPO_CLUB_ARCHITECTURE.md` — target, data ownership, reward policy, migration and rollback.
- `KAPO_CLUB_PRODUCTION_READINESS.md` — implemented features, verification, known limits and production gates.
- `KAPO_LAUNCH_AUDIT.md` — wider storefront/payment/fulfillment/email blockers; this is the historical pre-implementation audit.

A development-only `/account?preview=1` shows clearly labeled fictional design data. It never authenticates a visitor or mutates account records and is ignored in production.
