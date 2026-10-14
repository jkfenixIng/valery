# ADR-002: Use Drizzle with native Windows PostgreSQL for local persistence

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: data, portability

## Context

ODD-0.5 introduces the first PostgreSQL persistence adapter. Daily development runs against PostgreSQL installed natively on Windows; ORM and driver concerns must remain in infrastructure.

## Decision

Use Drizzle ORM, drizzle-kit, and `pg` in `src/shared/infrastructure/db`. `DATABASE_URL` is validated centrally and required when that adapter is loaded. Drizzle generates DDL migrations; every generated migration is versioned without manual edits. Data backfills use a separate, tracked `drizzle-kit generate --custom --name <name>` migration containing data statements only; generated DDL and custom data migrations remain separate and ordered.

`docker-compose.yml` is a PostgreSQL-only Compose Spec contract for later Linux CI validation. It is versioned but not run locally. This cut has no Docker Desktop requirement, application container, deployment, hosting, VPS, Neon, or CI Docker job.

## Alternatives considered

- SQL in domain or application: rejected because it violates layer boundaries.
- Docker as the daily Windows database runtime: rejected because native PostgreSQL is the approved local runtime.
- Managed database or deployment now: rejected because infrastructure delivery is out of scope.

## Consequences

The F0 schema, migrator, and idempotent seed are infrastructure-only. Dependency-cruiser prohibits `drizzle-orm` and `pg` imports from domain and application.

## Verification

`pnpm verify` checks unit, configuration, architecture, and build gates. A local database enables `db:migrate` and `db:seed`; Compose syntax can be checked without starting containers when the Docker CLI supports it.

**Development testing note (2026-10-13):** during development, DB-backed tests are not executed. Persistence adapters are verified with mocked Drizzle clients that never open a connection (transaction scope, audit ordering, canonical values, active-row filters, constraint mapping, and row mapping). Real PostgreSQL validation of migrations, seeds, and repositories is deferred to the final testing phase together with E2E.

**Migration amendment (2026-10-13):** F1-04 uses generated DDL migration `0004`, custom data migration `0005` for legacy `product_components.quantity` backfill, then generated DDL migration `0006` to require `quantity_fraction`. The data migration stores exact decimal-rational `n/1000` text without inferring semantic fractions; `Quantity.parse` normalizes it at the application boundary.
