# Progress

## Phase 0 — closed locally

- **F0-01:** pnpm, Next.js, strict TypeScript, linting, formatting, and quality gates. `pnpm verify` runs lint, typecheck, test, architecture, build, security-headers smoke, and PWA smoke; formatting is checked separately with `pnpm format`.
- **F0-02:** clean module boundaries, domain primitives, composition container, and enforced dependency rules.
- **F0-03:** Zod-validated configuration and secret-free `.env.example` placeholders.
- **F0-04:** Drizzle/PostgreSQL schema, generated migrations, migrator, and idempotent example seed for native Windows PostgreSQL.
- **F0-05:** PostgreSQL Compose Spec contract for future Linux validation.
- **F0-06:** Better Auth/Drizzle administrator access: argon2id, mandatory TOTP and recovery codes, account lockout, rate limits, protected boundaries, `audit_logs`, and a generated migration.
- **F0-07:** security headers and request nonce CSP, dependency and secret scanning controls, security model, incident plan, and operational runbooks.
- **F0-08:** local accessible design tokens, shared UI primitives, themes, and `/design`.
- **F0-09:** local Serwist PWA shell: generated ignored `public/sw.js`, public shell precaching only, local icons, manifest, `/~offline`, and network-only navigations with no runtime cache.
- **F0-10:** continuity documentation, ADRs, progress tracking, security documentation, and runbooks.

The public DTO guard `assertPublicDto` is available but not yet applied, because no public catalog boundary exists. It MUST be applied at that boundary when it is introduced.

`test:e2e` is written but deferred to the final testing phase; it was not run for this local closure.

## Phase 1 — in progress

- **F1-01:** pure pricing engine and golden cases are complete locally.
- **F1-02:** persisted pricing settings at `/admin/ajustes` are complete locally.
- **F1-03:** supplies can be created, edited, listed while active, and archived at `/admin/insumos`; mutations require a rechecked TOTP-enabled admin and are audited without supply details. Supply name/unit limits (120/32 trimmed characters) are technical safeguards enforced by the domain and form boundary, not business rules. The unchanged unique `(category_id, name)` constraint means an archived same-name supply cannot be recreated.
- **F1-04:** products at `/admin/productos` support recipes, bases with extras, bundles, and fixed prices. Exact component quantities persist as authoritative `quantity_fraction` text and become normalized `Quantity` values at the application boundary; legacy numeric `quantity` is compatibility-only. The generated DDL migrations `0004` and `0006` surround custom data migration `0005`, which backfills legacy decimals as exact `n/1000` rationals without guessing semantic fractions. Product cost recalculation remains F1-05.

Persistence adapters are verified with mocked Drizzle clients; no test opens a database connection during development (see ADR-002).

## Explicitly deferred

- Real PostgreSQL validation of migrations, seeds, and repositories, together with E2E in the final testing phase.
- Application Dockerfile and app Compose runtime.
- Linux CI portability and runtime Docker validation.
- Vercel and Neon preview environments.
- Backup, restore, retention, and recovery verification.
- HSTS until an HTTPS hosting decision is approved.
- PWA installation and offline validation on a non-localhost HTTPS origin.
- `GHSA-vfj7-8cjw-p6xm` (`braces`): no patched upstream release is available.
