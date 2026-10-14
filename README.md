# Valery

[![License: MIT](https://img.shields.io/badge/License-MIT-8B5CF6.svg)](./LICENSE)

A thoughtful business workspace for turning handmade ideas into clear quotes, organized orders, and confident everyday decisions.

## Overview

Valery is a mobile-first platform for a small handmade business. It brings together:

- Quotes that account for materials, work, and profit.
- A public catalog that guides customers to WhatsApp with their selection.
- Order tracking from request to delivery.
- Inventory visibility for supplies and low-stock decisions.
- Simple business numbers for sales, expenses, and earnings.

## Project status

**Phase 0 is closed locally.** The local-first foundation now includes layered architecture, validated configuration, Drizzle/PostgreSQL persistence, one seeded Better Auth administrator with mandatory TOTP, security controls and runbooks, accessible local UI primitives, and a Serwist PWA shell.

Deployment and production operations are not approved yet. See [progress](./docs/progress.md) for the completed scope and deferred work.

## Stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS.
- Drizzle ORM with PostgreSQL.
- Better Auth with argon2id passwords, mandatory TOTP, recovery codes, lockout, rate limits, and audit events.
- Serwist PWA with a public shell and offline fallback.

## Local setup

Prerequisites: Node.js 24, Corepack, and native Windows PostgreSQL for database work.

```bash
corepack pnpm install
Copy-Item .env.example .env.local
```

Set these values in untracked `.env.local`:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Then prepare the local database with the committed migrations:

```bash
corepack pnpm db:setup
```

`db:setup` applies pending migrations, runs the idempotent example seed, and creates the administrator when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set; it does not delete data. To create only the administrator, run `corepack pnpm db:seed:admin`.

Public sign-up is disabled. After the initial sign-in, enroll an authenticator app at `/auth/two-factor/setup` before accessing `/admin`.

## Scripts

| Script                                | Purpose                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `corepack pnpm dev`                   | Start Next.js and watch the Serwist service worker.                             |
| `corepack pnpm build`                 | Create the production build and service worker.                                 |
| `corepack pnpm start`                 | Start the production server.                                                    |
| `corepack pnpm lint`                  | Run ESLint.                                                                     |
| `corepack pnpm format`                | Check formatting with Prettier.                                                 |
| `corepack pnpm typecheck`             | Run strict TypeScript checks.                                                   |
| `corepack pnpm test`                  | Run Vitest unit tests.                                                          |
| `corepack pnpm test:coverage`         | Run unit tests with coverage.                                                   |
| `corepack pnpm test:architecture`     | Validate layer and environment-access rules.                                    |
| `corepack pnpm test:security-headers` | Smoke-test production security headers.                                         |
| `corepack pnpm test:pwa`              | Smoke-test the production PWA endpoints.                                        |
| `corepack pnpm test:e2e`              | Run Playwright E2E tests against PostgreSQL and the authentication environment. |
| `corepack pnpm audit:dependencies`    | Fail on high or critical dependency advisories.                                 |
| `corepack pnpm scan:secrets`          | Run the installed Gitleaks binary through the repository wrapper.               |
| `corepack pnpm db:generate`           | Generate Drizzle migrations.                                                    |
| `corepack pnpm db:migrate`            | Apply pending database migrations.                                              |
| `corepack pnpm db:seed`               | Run the idempotent example seed.                                                |
| `corepack pnpm db:seed:admin`         | Create the seeded administrator idempotently.                                   |
| `corepack pnpm db:setup`              | Apply migrations and run the idempotent seeds.                                  |
| `corepack pnpm verify`                | Run the local quality gate.                                                     |

## Quality gate

Run `corepack pnpm verify` before delivery. It runs lint, typecheck, unit tests, architecture checks, production build, security-header smoke tests, and PWA smoke tests. Run `corepack pnpm format` separately for formatting.

`test:e2e` is written but deferred to the final testing phase and intentionally excluded from `verify`. Unit tests never open a database connection: persistence adapters are tested with mocked Drizzle clients, and real PostgreSQL validation is deferred to the same final phase.

## Security and PWA

The production baseline includes a request-nonce CSP, framing, MIME-sniffing, referrer, and permissions protections. HSTS remains deferred until an HTTPS hosting decision is approved. The PWA only precaches public shell assets and uses no runtime cache for authenticated or private traffic; installation and non-localhost offline validation require HTTPS.

For security controls and incident guidance, read [Security](./docs/security.md); report vulnerabilities privately as described in [SECURITY.md](./SECURITY.md). Operational procedures are in the [runbooks](./docs/runbooks/).

## Deferred items

- Application Dockerfile and Compose runtime.
- Linux CI portability and runtime Docker validation.
- Vercel and Neon preview environments.
- Backup, restore, retention, and recovery verification.
- HSTS after an HTTPS hosting decision.
- PWA installation and offline validation over HTTPS.
- The `braces` advisory (`GHSA-vfj7-8cjw-p6xm`) until an upstream patch is available.

## Documentation

- [Product Requirements Document](./PRD%20-%20Plataforma%20de%20negocio%20de%20Valery%20%28cotizaciones%2C%20cat%C3%A1logo%2C%20pedidos%20e%20inventario%29.md)
- [Architecture decisions](./docs/adr/)
- [Implementation progress](./docs/progress.md)
- [Security](./docs/security.md)
- [Runbooks](./docs/runbooks/)

## License

This project is licensed under the [MIT License](./LICENSE).
