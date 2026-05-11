# Better Bucks

Better Bucks is an employee rewards platform that lets companies give, track, and redeem points ("Bucks") — built for deskless and frontline workers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 18 + Vite 7, Tailwind CSS v3, wouter, TanStack Query
- API: Express 5 with sessions (connect-pg-simple), Passport.js, Stripe, WebSockets
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (ESM bundle for API server)

## Where things live

- `lib/db/src/schema/schema.ts` — single source of truth for all DB tables and Zod insert schemas
- `artifacts/api-server/src/routes/routes.ts` — all API routes (large monolithic file, 8400+ lines)
- `artifacts/api-server/src/app.ts` — Express app setup (auth, session, Stripe webhook, middleware)
- `artifacts/better-bucks/src/` — React frontend
- `artifacts/better-bucks/src/shared/schema.ts` — re-exports from lib/db schema for frontend use
- `artifacts/better-bucks/src/shared/routes.ts` — frontend-safe API route constants
- `artifacts/better-bucks/tailwind.config.ts` — Tailwind theme (navy primary, green secondary)

## Architecture decisions

- No OpenAPI spec: The routes.ts is a 8400-line legacy monolith; skipped codegen in favor of direct fetch in the frontend.
- `@shared/schema` in frontend resolves via Vite alias → `src/shared/schema.ts` → re-exports from `lib/db/src/schema/schema.ts` (Vite fs.strict: false enables cross-root access).
- Session store uses `connect-pg-simple` backed by the same Postgres DB.
- `stripe-replit-sync`, `@anthropic-ai/sdk`, and `node-forge` are marked external in esbuild so they load at runtime without bundling.
- Dynamic imports inside routes.ts use `../auth`, `../walletPass`, `../walletQrToken` (relative to `src/routes/`).

## Product

- Employee dashboard: view Bucks balance, redeem at the store, track orders, complete surveys
- Admin dashboard: reward employees, manage goals, configure the store, view reports
- Organization signup and multi-tier subscription (Stripe)
- Apple Wallet pass generation for employee Bucks cards
- Demo mode, affiliate system, blog, merchant QR scanner

## Gotchas

- Password hashing uses `bcryptjs` (pure-JS, no native build required). The old `bcrypt` native addon has been removed.
- Always push DB schema with `pnpm --filter @workspace/db run push` after schema changes.
- Do NOT import from `@workspace/db` (index) in the frontend — it triggers the pg pool connection. Use `@shared/schema` (alias) instead, which points to just the schema file.
- `zod/v4` is a subpath export of `zod@^3.24`; add `zod` to any package that needs `zod/v4`.

## Environment variables

### Required secrets (set in Replit Secrets)
- `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)
- `SESSION_SECRET` — Express session signing secret

### Email (Nodemailer SMTP + Gmail API fallback)
- `SMTP_USER` — SMTP username / sending address (e.g. `you@gmail.com`)
- `SMTP_PASS` — SMTP password or app password
- `SMTP_HOST` — SMTP hostname (default: `smtp.gmail.com`)
- `SMTP_PORT` — SMTP port (default: `587`)
- `ADMIN_ALERT_EMAIL` — recipient for ops/lockout alert emails (optional)
- `ALERT_WEBHOOK_URL` — Slack webhook URL for ops alerts (optional)

### Stripe
- `STRIPE_SECRET_KEY` — server-side secret key (`sk_live_…` or `sk_test_…`)
- `STRIPE_PUBLISHABLE_KEY` — publishable key (`pk_live_…` or `pk_test_…`); exposed to the frontend via `GET /api/stripe/publishable-key` — **not** a VITE_ variable
- `STRIPE_WEBHOOK_SECRET` — webhook signing secret (`whsec_…`); enables signature verification in `artifacts/api-server/src/webhookHandlers.ts`; requires the endpoint `POST /api/stripe/webhook` to be registered in the Stripe Dashboard

### Frontend (Vite — must be prefixed `VITE_` to be exposed to the browser)
- `VITE_GA_MEASUREMENT_ID` — Google Analytics 4 Measurement ID (`G-XXXXXXXXXX`); initialised in `artifacts/better-bucks/src/lib/analytics.ts`
- `VITE_TURNSTILE_SITE_KEY` — Cloudflare Turnstile site key (falls back to test key `1x00000000000000000000AA` if unset)
- `VITE_HCAPTCHA_SITE_KEY` — hCaptcha site key (falls back to test key if unset)

### Bot protection (server-side)
- `TURNSTILE_SECRET_KEY` — Cloudflare Turnstile secret key (falls back to always-pass test key `1x0000000000000000000000000000000AA` if unset — **production must set this**)
- `HCAPTCHA_SECRET` — hCaptcha secret key; verified server-side on signup (web + mobile). When unset, verification is bypassed — **production must set this**
- `MOBILE_SIGNUP_RATE_LIMIT` — max mobile org signup attempts per IP per hour (default: `5`); set lower in production to tighten the gate

### Bot protection (mobile — Expo public)
- `EXPO_PUBLIC_HCAPTCHA_SITE_KEY` — hCaptcha site key for the mobile signup flow. When unset, the captcha step is skipped — **production must set this**

## Social auth env vars (mobile)

- `APPLE_BUNDLE_ID` — Apple identity token audience validation. Defaults to `net.betterbucks.app` (from app.json). Override if the bundle ID changes.
- `GOOGLE_ALLOWED_CLIENT_IDS` — Comma-separated list of allowed Google OAuth client IDs for audience validation (e.g. `123.apps.googleusercontent.com,456.apps.googleusercontent.com`). **Set this in production** to prevent tokens issued for other apps from being accepted. If unset, a warning is logged and the check is skipped (backward-compatible default).

## Google Wallet env vars (Android)

- `GOOGLE_WALLET_ISSUER_ID` — Issuer ID from the [Google Pay & Wallet Console](https://pay.google.com/business/console).
- `GOOGLE_WALLET_CLASS_ID` — The suffix of the loyalty/generic class created in the Wallet Console (the full class ID will be `{GOOGLE_WALLET_ISSUER_ID}.{GOOGLE_WALLET_CLASS_ID}`).
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` — Email of the service account that has the Google Wallet API enabled.
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` — RSA private key for the service account (PEM format, or base64-encoded PEM). Literal `\n` sequences are automatically converted to newlines.

The `googleWalletPass.ts` module returns a signed JWT embedded in `https://pay.google.com/gp/v/save/{jwt}`. On Android the mobile app opens this URL via `Linking.openURL` which launches the Google Wallet "Add to Wallet" flow. If any of the four env vars are missing the endpoint returns HTTP 503 with a human-readable message (no crash).

## User preferences

_Populate as you build._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
