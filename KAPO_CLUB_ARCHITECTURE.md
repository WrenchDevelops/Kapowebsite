# KAPO Club architecture and migration plan

## Selected implementation target

Keep Cloudflare D1 and the existing vinext/Worker application. Use Clerk for verified email authentication, optional Google sign-in, session refresh and revocation. Use Clerk's React UI and framework-independent Backend SDK so identity verification does not depend on a Next-only middleware or trusted incoming identity headers. D1 remains the system of record for profiles, order ownership, wishlist, reward ledger and reservations.

This is a local implementation target, not approval to move the public domain or alter infrastructure. The current standalone Vercel build has no D1 binding; it must not activate KAPO Club commerce until a supported runtime/database is connected. No Supabase migration, production data rewrite or DNS cutover is part of this implementation.

## Identity boundary

Remove the legacy name/email cookie login and all header-based identity. Verify Clerk session signature, issuer/expiry and authorized parties, then check the authoritative session is active and the primary email is verified. Use the immutable Clerk subject as the account ID. Admin requires that same identity plus KAPO_ADMIN_EMAILS. No development admin bypass grants access.

Clerk owns passwords, email challenges, Google OAuth and recovery. Configure email code/link authentication, mandatory email verification, session lifetime around 30 days, and Google only if configured for KAPO. Development email-code login has been verified; the existing development application now has a 30-day maximum session lifetime and optional phone/username. Production configuration remains a separate approval/acceptance step. The app does not implement password storage. Revocation is checked server-side; errors deny private access. Profile changes do not change verified email. Security/email/session management uses Clerk's account controls.

## Persistence and rewards

Use additive schema migration(s), immutable ledger entries with unique event references, and D1 transactional batch statements. Database constraints enforce account ownership and available balance for redemption. Balance is derived from ledger entries; a database-maintained projection exists only for atomic balance checks, never as a client-editable balance.

Starting policy: 10 points per eligible merchandise dollar, 100 points per reward dollar, minimum 300 points/$3, 50 verified signup points, 100 first qualifying completed-order points. Eligible merchandise excludes discounts, tax and shipping. Fractional points round down. Default redemption requires at least $10 merchandise and cannot cover more than merchandise value. Birthday/review bonuses are disabled. USD only for this initial policy.

Award only when paid/partially refunded and shipped/delivered. Use one immutable reward basis per order; refund reversal is cumulative, conservative and capped at the original eligible spend. As the existing refund data only contains a total refund amount, subtract that amount from merchandise first rather than speculate which item/tax/shipping was refunded. Refunding all eligible merchandise reverses earned spend and first-order bonus points, even if shipping remains charged. Refunds can make a balance negative if previously earned points were already spent; further redemption stays blocked. Refunds of redeemed orders restore the proportional spent points, with full refunds restoring all consumed points. Do not issue cash for points.

Redemption is an account-bound reservation, not a general coupon. Revalidate ownership, balance, expiry, eligible subtotal and active flags on checkout. Hold points atomically; retain the hold while a Stripe session can still complete; release only after authoritative session expiry/failure or explicit server-side cancellation before session creation. Spend on paid settlement and release on unpaid expiry/failure. Checkout creation and Stripe settlement/expiry share a per-quote database lease, preventing replacement-session races from prematurely releasing a hold. Redemptions and ordinary promo codes cannot stack initially. Policy values are captured with awards/reservations so later edits do not rewrite history.

Guest checkout remains available. Verified users may explicitly claim guest orders with their current verified purchase email; existing orders attached to another account cannot be claimed. Never silently treat legacy unverified IDs as verified ownership. No automatic legacy points backfill.

## Rollout and migration

1. Review this plan; back up and identify the authoritative production D1 instance and current migration state.
2. Apply new schema to an isolated local/test D1 database; run concurrency, refund and identity tests.
3. Configure a KAPO Clerk development application and permitted local/test origins. Keep secrets in ignored environment files/runtime secrets. No client may receive CLERK_SECRET_KEY.
4. Verify real email ownership, refresh, account recovery, Google (if enabled), revocation, guest claim and admin access against a staging Worker.
5. Explicit approval is required before any remote migration, identity-provider production configuration, deployment/domain cutover or production backfill. No old tables/records are deleted. Old insecure account cookies become invalid immediately and require fresh verified sign-in.
6. Apply the additive migration through the selected deployment system, not from application requests. Rehearse restore. Verify orders, provider webhooks and transactional email.
7. KAPO_CLUB_ENABLED and KAPO_REWARDS_REDEMPTION_ENABLED default off. Keep live payment gate off until the complete acceptance journey passes. No real reward redemption is activated by this change.

Rollback: disable Club/redemption gates; roll back application code to a secure identity version while retaining additive tables and ledger history. Never restore the old email-cookie/header authentication. Do not erase points or holds to roll back. Reconcile any provider sessions before releasing reservations.

## External verification still required

Clerk application credentials/configuration, actual email/Google flows and 30-day session policy; actual Cloudflare staging/production binding; approved migrations/backups; Stripe test settlement/refunds; test fulfillment; controlled inbox delivery. Local tests cannot certify these external states.
