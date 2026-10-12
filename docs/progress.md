# Progress

## ODD-0.1..0.5

Completed local foundation:

- Framework, tooling, quality gates, and clean boundaries.
- Central configuration with PostgreSQL URL validation.
- Drizzle/PostgreSQL infrastructure: F0 schema, generated first migration, migrator, and idempotent example seed.
- Native Windows PostgreSQL as the daily development runtime.
- PostgreSQL-only Compose Spec contract for later Linux CI validation; it is not run locally.

## Deferred

Docker runtime validation in Linux CI, backup and restore workflow, authentication, PWA, complex UI, and all hosting or deployment integrations remain outside this cut.
