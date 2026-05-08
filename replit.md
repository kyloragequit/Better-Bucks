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

## Social auth env vars (mobile)

- `APPLE_BUNDLE_ID` — Apple identity token audience validation. Defaults to `net.betterbucks.app` (from app.json). Override if the bundle ID changes.
- `GOOGLE_ALLOWED_CLIENT_IDS` — Comma-separated list of allowed Google OAuth client IDs for audience validation (e.g. `123.apps.googleusercontent.com,456.apps.googleusercontent.com`). **Set this in production** to prevent tokens issued for other apps from being accepted. If unset, a warning is logged and the check is skipped (backward-compatible default).

## User preferences

_Populate as you build._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
