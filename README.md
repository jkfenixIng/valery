# Valery

[![License: MIT](https://img.shields.io/badge/License-MIT-8B5CF6.svg)](./LICENSE)

A thoughtful business workspace for turning handmade ideas into clear quotes, organized orders, and confident everyday decisions.

## Overview

Valery is planned as a mobile-first platform for a small handmade business. It brings together:

- Quotes that account for materials, work, and profit.
- A public catalog that guides customers to WhatsApp with their selection.
- Order tracking from request to delivery.
- Inventory visibility for supplies and low-stock decisions.
- Simple business numbers for sales, expenses, and earnings.

## Project Status

**Phase 0 — local-first.**

The project is in its foundation stage. Deployment is intentionally deferred while the local architecture, security boundaries, and core workflow are established.

## Product Scope

### Private workspace

- Costing and quotations
- Products, recipes, and supplies
- Orders, customers, and inventory
- Simple business numbers

### Public experience

- Product catalog
- Product options and starting prices
- WhatsApp order handoff

## Local development

Prerequisites: Node.js 24, Corepack, and a native Windows PostgreSQL instance for database work.

```bash
corepack pnpm install
Copy-Item .env.example .env.local
corepack pnpm db:generate
corepack pnpm db:setup
corepack pnpm verify
```

Set `DATABASE_URL` in `.env.local` to your native PostgreSQL development database. `db:setup` applies pending migrations and runs the idempotent seed; it does not reset or delete data. The verification command runs linting, strict type checking, unit tests, architecture rules, a production HTTP security-header smoke test, and the production build. Run `corepack pnpm audit:dependencies` separately; it fails on high or critical advisories. CI runs that audit and secret scanning only for `develop` pushes and pull requests.

## Administrator authentication

Set `BETTER_AUTH_SECRET` (at least 32 random characters), `BETTER_AUTH_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` (at least 12 characters) in untracked `.env.local`. Then run `corepack pnpm db:setup`, or create only the idempotent administrator with `corepack pnpm db:seed:admin`. Public sign-up is disabled.

The administrator must enroll an authenticator app at `/auth/two-factor/setup` before entering `/admin`. The setup page shows a one-time manual secret/otpauth URI and ten recovery codes; store those codes offline because each works only once. To recover a lost authenticator, the responsible adult signs in with a recovery code. If every recovery code is lost, reset TOTP by deleting that administrator's `two_factor` row and setting `user.two_factor_enabled` to `false` in a controlled PostgreSQL maintenance session, then sign in and enroll again. Record the intervention outside the application and rotate the administrator password afterward.

`corepack pnpm test:e2e` requires PostgreSQL plus all five authentication variables and is deliberately excluded from `verify`, which remains database-free.

## Security baseline

Global response headers include a per-request nonce CSP, framing protection, MIME-sniffing protection, referrer policy, and a restrictive permissions policy. The CSP permits `unsafe-eval` only during `next dev`; production emits neither `unsafe-eval` nor `unsafe-inline`. Nonces require dynamic rendering so Next can inject them during SSR. HSTS is intentionally deferred until an HTTPS deployment is approved.

## Local PWA

`corepack pnpm build` builds the Serwist service worker after Next prerendering and copies generated public assets into the standalone output. `corepack pnpm test:pwa` verifies that the production server serves the manifest, `/sw.js`, and `/~offline`.

The service worker precaches only the public shell build assets, the three local icons, the manifest, and the `/~offline` fallback. Network-only navigation handling reaches that fallback while caching nothing at runtime: it never caches `/admin`, `/auth`, `/api`, custom `GET` responses, requests with cookies or `Authorization`, non-`GET` requests, or runtime documents. Service-worker registration is performed by a client component, not an inline script, so it remains compatible with the nonce CSP. The PWA is local-only; installation and offline behavior still require a browser with service-worker support and an HTTPS origin outside localhost.

Report a vulnerability privately as described in [SECURITY.md](./SECURITY.md). The repository is local-first Phase 0 and does not offer a security SLA, bounty, or public production service.

Run an installed Gitleaks binary with `corepack pnpm scan:secrets`; the command is opt-in and clearly fails when the binary is unavailable. CI uses the SHA-pinned official Gitleaks action, without adding an npm wrapper.

`docker-compose.yml` is versioned only as a portable PostgreSQL contract for future Linux CI validation. Docker Desktop is not required for daily Windows development and is not started by these instructions.

## Documentation

- [Product Requirements Document](./PRD%20-%20Plataforma%20de%20negocio%20de%20Valery%20%28cotizaciones%2C%20cat%C3%A1logo%2C%20pedidos%20e%20inventario%29.md)
- [Architecture decisions](./docs/adr/)
- [Implementation progress](./docs/progress.md)
- [Backup and CI portability pending](./docs/backup-and-ci-pending.md)

## License

This project is licensed under the [MIT License](./LICENSE).
