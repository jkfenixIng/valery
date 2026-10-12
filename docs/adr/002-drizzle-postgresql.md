# ADR-002: Use Drizzle with native Windows PostgreSQL for local persistence

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: data, portability

## Context

ODD-0.5 introduces the first PostgreSQL persistence adapter. Daily development runs against PostgreSQL installed natively on Windows; ORM and driver concerns must remain in infrastructure.

## Decision

Use Drizzle ORM, drizzle-kit, and `pg` in `src/shared/infrastructure/db`. `DATABASE_URL` is validated centrally and required when that adapter is loaded. Drizzle generates migrations; the generated migration is versioned without manual edits.

`docker-compose.yml` is a PostgreSQL-only Compose Spec contract for later Linux CI validation. It is versioned but not run locally. This cut has no Docker Desktop requirement, application container, deployment, hosting, VPS, Neon, or CI Docker job.

## Alternatives considered

- SQL in domain or application: rejected because it violates layer boundaries.
- Docker as the daily Windows database runtime: rejected because native PostgreSQL is the approved local runtime.
- Managed database or deployment now: rejected because infrastructure delivery is out of scope.

## Consequences

The F0 schema, migrator, and idempotent seed are infrastructure-only. Dependency-cruiser prohibits `drizzle-orm` and `pg` imports from domain and application. PostgreSQL integration tests run only when `DATABASE_URL` is available.

## Verification

`pnpm verify` checks unit, configuration, architecture, and build gates. A local database enables `db:migrate`, `db:seed`, and PostgreSQL integration tests; Compose syntax can be checked without starting containers when the Docker CLI supports it.
