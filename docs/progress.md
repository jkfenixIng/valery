# Progress

## Phase 0 — closed locally

- **F0-01:** pnpm, Next.js, strict TypeScript, linting, formatting, and `pnpm verify` quality gates.
- **F0-02:** clean module boundaries, domain primitives, composition container, and enforced dependency rules.
- **F0-03:** Zod-validated configuration and secret-free `.env.example` placeholders.
- **F0-04:** Drizzle/PostgreSQL schema, generated migrations, migrator, and idempotent example seed for native Windows PostgreSQL.
- **F0-05:** PostgreSQL Compose Spec contract for future Linux validation.
- **F0-06:** Better Auth/Drizzle administrator access: argon2id, mandatory TOTP and recovery codes, account lockout, rate limits, protected boundaries, `audit_logs`, and a generated migration.
- **F0-07:** security headers and request nonce CSP, dependency and secret scanning controls, security model, incident plan, and operational runbooks.
- **F0-08:** local accessible design tokens, shared UI primitives, themes, and `/design`.
- **F0-09:** local Serwist PWA shell: generated ignored `public/sw.js`, public shell precaching only, local icons, manifest, `/~offline`, and no runtime caching.
- **F0-10:** continuity documentation, ADRs, progress tracking, security documentation, and runbooks.

`test:e2e` is written but deferred to the final testing phase; it was not run for this local closure.

## Explicitly deferred

- Application Dockerfile and app Compose runtime.
- Linux CI portability and runtime Docker validation.
- Vercel and Neon preview environments.
- Backup, restore, retention, and recovery verification.
- HSTS until an HTTPS hosting decision is approved.
- PWA installation and offline validation on a non-localhost HTTPS origin.
- `GHSA-vfj7-8cjw-p6xm` (`braces`): no patched upstream release is available.
