# KAPO environment variables

Copy names from `.env.example` into a local file. Do not commit real keys.

| File | Used by |
| --- | --- |
| `.env.local` | Next/vinext local server. Gitignored. |
| `.dev.vars` | Cloudflare Worker preview (`wrangler`). Gitignored. |
| Worker secrets | Production runtime. Set in the host, not in the repo. |

Empty strings are treated as unset. Boolean flags are on only when the value is exactly `true`.

`NODE_ENV=production` turns off the admin dev bypass, the account preview, and automatic database migration unless `KAPO_AUTO_MIGRATE=true`.

## Checkout and shipping

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Yes, to take payment | | Secret key. Use `sk_test_...` until live charges are an explicit decision. `sk_live_` and `rk_live_` are refused unless `KAPO_ALLOW_LIVE_PAYMENTS=true`. |
| `STRIPE_PUBLISHABLE_KEY` | Yes, to open checkout | | Publishable key returned to the browser. Use `pk_test_...`. `pk_live_` is withheld unless live payments are allowed. |
| `STRIPE_WEBHOOK_SECRET` | Yes, to mark orders paid | | Signing secret for `/api/webhooks/stripe`. Test and live endpoints have different secrets. |
| `STRIPE_TAX_ENABLED` | No | `false` | Turns on Stripe automatic tax. Leave `false` until tax registration is done. |
| `KAPO_ALLOW_LIVE_PAYMENTS` | Live only | `false` | Must be `true` before any live Stripe charge. |
| `SHIPPO_MODE` | Yes | `test` | `test` or `live`. `live` still uses the test token until `KAPO_ALLOW_LIVE_LABELS=true`. |
| `SHIPPO_TEST_API_KEY` | Yes, for rates and test labels | | Token starting with `shippo_test_`. |
| `SHIPPO_LIVE_API_KEY` | Live postage only | | Token starting with `shippo_live_`. Unused while mode is `test` or live labels are off. |
| `SHIPPO_API_TOKEN` | No | | Legacy fallback. A live token here is ignored in test mode. |
| `SHIPPO_WEBHOOK_TOKEN` | One Shippo check | | Random token you put in the webhook URL: `/api/webhooks/shippo?token=...`. |
| `SHIPPO_WEBHOOK_SECRET` | One Shippo check | | Optional HMAC secret. If both token and secret are set, both checks must pass. |
| `KAPO_ALLOW_LIVE_LABELS` | Live postage only | `false` | Must be `true` together with `SHIPPO_MODE=live` before a real label is bought. |
| `KAPO_LABEL_MAX_CENTS` | No | `1500` | Per-label cap in cents ($15). |
| `KAPO_LABEL_DAILY_MAX_CENTS` | No | `5000` | Daily postage cap in cents ($50). |
| `KAPO_LABEL_LIMITS_OVERRIDE` | No | `false` | `true` removes those two caps. |
| `KAPO_SHIPPO_ENFORCE_IP_ALLOWLIST` | No | `false` | Accept Shippo webhooks only from Shippo's published IPs. Enable only if the host forwards a trusted client IP. |
| `KAPO_SHIPPING_ORIGIN` | Yes, to quote shipping | | JSON ship-from address. Required fields: `name`, street (`street1` or `line1`), `city`, `state` (US code), ZIP (`zip` or `postalCode`), `country` (`US`), `email`. Optional: `phone`, `line2`. |
| `KAPO_DEFAULT_CURRENCY` | No | `usd` | Checkout currency. |
| `KAPO_SHIPPING_HANDLING_FEE_CENTS` | No | `0` | Extra handling fee added to the shipping quote, in cents. |
| `KAPO_SHIPPING_QUOTE_TTL_SECONDS` | No | `1800` | How long a shipping quote stays valid. |
| `KAPO_PRODUCTION_DAYS_MIN` | No | `5` | Short end of the production window shown to customers. |
| `KAPO_PRODUCTION_DAYS_MAX` | No | `10` | Long end of the production window. |
| `KAPO_PARCEL_LENGTH_IN` | No | `8` | Mailer length in inches. Values outside 0–48 fall back to the default. |
| `KAPO_PARCEL_WIDTH_IN` | No | `6` | Mailer width in inches. |
| `KAPO_PARCEL_HEIGHT_IN` | No | `2` | Mailer height in inches. |
| `KAPO_PACKAGING_WEIGHT_GRAMS` | No | `35` | Mailer packaging weight. Larger orders use a fixed box (10×8×4 in, 80 g) that these variables do not change. |
| `KAPO_SHIP_TO_COUNTRIES` | No | `US` | Comma-separated country codes. Address validation still accepts US only. |
| `KAPO_DISCOUNT_CODES` | No | empty | Comma-separated `CODE:percent:N` or `CODE:amount:CENTS`. Example: `WELCOME:percent:10,CREW:amount:500`. Codes are matched case-insensitively. Percent must be 1–100. Amount is cents. |

## Admin and sessions

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `KAPO_ADMIN_EMAILS` | Yes, for admin | | Comma-separated emails allowed into `/admin`. The person must also be a verified Clerk user. |
| `KAPO_ADMIN_DEV_BYPASS` | Local only | `false` | Ignored when `NODE_ENV` is `production`. Do not use this on a public host. |
| `KAPO_SESSION_SECRET` | If local account cookies are used | | Signs the legacy local session. Production refuses those cookies when this is empty. Clerk is the customer identity path. |
| `KAPO_AUTO_MIGRATE` | No | off in production | `true` lets the app apply migrations during a production request. Leave unset and run migrations on purpose. |

## Email, newsletter, and texts

Order mail is sent from the addresses in `lib/email/addresses.ts` (`orders@shopkapo.com` and the other shopkapo.com mailboxes). `KAPO_EMAIL_FROM` is still read, but it does not change those senders.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `RESEND_API_KEY` | Yes, to send mail | | Resend API key. Without it, order mail stays queued. |
| `RESEND_WEBHOOK_SECRET` | For delivery stats | | Resend webhook signing secret. Updates delivered, bounced, and complaint counts. |
| `KAPO_EMAIL_FROM` | No | `KAPO Orders <orders@shopkapo.com>` | Stored from-address. Outgoing order and newsletter mail uses the hardcoded senders above. |
| `KAPO_PUBLIC_SITE_URL` | Yes | `https://shopkapo.com` | Canonical site origin for links in email and for Clerk. Must be `https://host` or `http://localhost` with an optional port. Anything else falls back to `https://shopkapo.com`. |
| `KAPO_MAILING_ADDRESS` | Yes, before a campaign sends | | Physical mailing address required on marketing email. Campaigns refuse to send while this is empty. |
| `KAPO_RESEND_AUDIENCE_ID` | For broadcasts | | Resend audience id. Required before a broadcast, and before sending when more than 500 subscribers are confirmed. |
| `KAPO_RESEND_TOPIC_PRODUCTS` | No | | Resend topic id for product announcements. |
| `KAPO_RESEND_TOPIC_DEALS` | No | | Resend topic id for deals. |
| `KAPO_RESEND_TOPIC_YOUTUBE` | No | | Resend topic id for YouTube posts. |
| `KAPO_RESEND_TOPIC_INSTAGRAM` | No | | Resend topic id for Instagram posts. |
| `KAPO_RESEND_TOPIC_NEWS` | No | | Resend topic id for news. When every topic id is set, a full-topic announcement can send as one broadcast. |
| `KAPO_YOUTUBE_CHANNEL_ID` | For automatic video posts | | Channel id for YouTube PubSubHubbub. Leave blank and add videos by hand. |
| `KAPO_YOUTUBE_HUB_TOKEN` | With the channel id | | Shared secret for `/api/webhooks/youtube`. |
| `KAPO_CRON_SECRET` | For the weekly digest | | Authorizes `GET` and `POST` `/api/cron/newsletter`. Monday runs the weekly digest. |
| `SENDBLUE_API_KEY` | For order texts | | Sendblue key. Checkout can offer text updates only when this, the secret, and the from-number are set. |
| `SENDBLUE_API_SECRET` | For order texts | | Sendblue API secret. |
| `SENDBLUE_FROM_NUMBER` | For order texts | | Sendblue sending number. |

## Support chat

The widget is visible unless `KAPO_CHAT_ENABLED` is `false` or `0`. Replies are generated only when both `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` are set. Numeric settings outside the allowed range fall back to the default.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `OPENROUTER_API_KEY` | To answer chats | | OpenRouter key. Stays on the server. |
| `OPENROUTER_MODEL` | To answer chats | `deepseek/deepseek-v4-flash` in `.env.example` | Model id sent to OpenRouter. |
| `OPENROUTER_SITE_URL` | No | | Site URL sent with the OpenRouter request. |
| `OPENROUTER_APP_NAME` | No | `KAPO Support` | App name sent with the OpenRouter request. |
| `KAPO_CHAT_ENABLED` | No | visible | `false` or `0` hides the widget. |
| `KAPO_CHAT_GREETING` | No | `Questions about our keycaps? 👋` | Short greeting, max 160 characters. |
| `KAPO_CHAT_WELCOME` | No | welcome line in `lib/support/config.ts` | First message, max 400 characters. |
| `KAPO_SUPPORT_EMAIL` | No | | Shown only when `KAPO_SUPPORT_EMAIL_VERIFIED=true` and the value is an email of 120 characters or fewer. |
| `KAPO_SUPPORT_EMAIL_VERIFIED` | No | `false` | Must be `true` before `KAPO_SUPPORT_EMAIL` is shown. |
| `KAPO_CHAT_MAX_INPUT_CHARS` | No | `800` | Visitor message length. Allowed 200–2000. |
| `KAPO_CHAT_MAX_HISTORY` | No | `10` | Turns kept in context. Allowed 2–16. |
| `KAPO_CHAT_MAX_OUTPUT_TOKENS` | No | `140` | Reply length. Allowed 64–800. |
| `KAPO_CHAT_DAILY_REQUESTS` | No | `40` | Requests per visitor per day. Allowed 5–200. |
| `KAPO_CHAT_IP_REQUESTS` | No | `12` | Requests per IP inside the window. Allowed 3–60. |
| `KAPO_CHAT_IP_WINDOW_MS` | No | `600000` | IP limit window in milliseconds. Allowed 1 minute to 1 hour. |
| `KAPO_CHAT_DAILY_BUDGET_USD` | No | `2` | Daily model spend cap in USD. Allowed 0.05–50. |
| `KAPO_CHAT_INPUT_USD_PER_MILLION` | No | `0.091` | Price used to estimate input cost. |
| `KAPO_CHAT_OUTPUT_USD_PER_MILLION` | No | `0.182` | Price used to estimate output cost. |
| `KAPO_CHAT_TIMEOUT_MS` | No | `25000` | Model request timeout. Allowed 5–45 seconds. |
| `KAPO_CHAT_RETENTION_DAYS` | No | `7` | How long chat transcripts are kept. Allowed 1–30 days. |
| `KAPO_CHAT_INSTRUCTIONS` | No | | Extra instructions appended to the support prompt, max 1200 characters. |

## KAPO Club

Leave both enable flags `false` until staging acceptance is approved. Missing Clerk keys disable sign-in. They do not fall back to a cookie identity.

| Variable | Required | Default | What it does |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes, for accounts | | Clerk publishable key. This one is sent to the browser. |
| `CLERK_SECRET_KEY` | Yes, for accounts | | Clerk secret key. Server only. Use `sk_test_...` in development. |
| `KAPO_AUTHORIZED_ORIGINS` | Yes | `https://shopkapo.com,https://www.shopkapo.com` | Comma-separated origins allowed to present a Clerk session. `KAPO_PUBLIC_SITE_URL` is always included. In development, `http://localhost:3000` is added, and other localhost / `127.0.0.1` origins in this list are accepted. |
| `KAPO_CLUB_ENABLED` | No | `false` | Turns on Club membership. |
| `KAPO_REWARDS_REDEMPTION_ENABLED` | No | `false` | Turns on point redemption. Also requires `KAPO_CLUB_ENABLED=true`. |
| `KAPO_REWARD_EARN_RATE` | No | `10` | Points earned per $1 of eligible fulfilled merchandise. Integer 1–100000. |
| `KAPO_REWARD_VALUE_RATE` | No | `100` | Points required for $1 of reward value. Redemptions must be a multiple of this. |
| `KAPO_REWARD_MINIMUM_POINTS` | No | `300` | Smallest redemption. Rounded up to a multiple of the value rate. |
| `KAPO_REWARD_SIGNUP_BONUS` | No | `50` | Points granted on signup. `0` is allowed. |
| `KAPO_REWARD_FIRST_ORDER_BONUS` | No | `100` | Points granted on the first order. `0` is allowed. |
| `KAPO_REWARD_MINIMUM_MERCHANDISE_CENTS` | No | `1000` | Merchandise subtotal, in cents, required before a reward can apply. |

## Local and platform only

These are not store configuration. Do not set them in production secrets.

| Variable | What it does |
| --- | --- |
| `KAPO_TEST_BASE_URL` | Base URL for `tests/club-http.test.mjs`. Defaults to `http://localhost:3000`. |
| `NODE_ENV` | `production` disables dev-only bypasses and the account design preview. |
| `VERCEL` | Set by Vercel. The Next config notices it. This app's database is D1 on Cloudflare Workers, so a Vercel deploy does not run commerce. |
