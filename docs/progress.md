# Progress

## ODD-0.1..0.6

Completed local foundation:

- Framework, tooling, quality gates, and clean boundaries.
- Central configuration with PostgreSQL URL validation.
- Drizzle/PostgreSQL infrastructure: F0 schema, generated first migration, migrator, and idempotent example seed.
- Native Windows PostgreSQL as the daily development runtime.
- PostgreSQL-only Compose Spec contract for later Linux CI validation; it is not run locally.
- Static security/supply-chain baseline: ADR-009 resolves the duplicated ADR number; production HTTP smoke coverage asserts all critical headers and rejects `unsafe-eval`; CI runs audit and SHA-pinned Gitleaks only for `develop` pushes and pull requests; local Gitleaks remains opt-in.
- CSP nonces remain separately pending because they require a runtime/rendering change; the static policy deliberately retains `unsafe-inline`.
- F0-06 authentication is complete: Better Auth/Drizzle, idempotent admin seeding, argon2id passwords, mandatory TOTP with ten recovery codes, per-account password lockout, database rate limits, layered `/admin` and private API protection, `audit_logs`, generated migration `0002`, and database-gated Playwright coverage.

## Deferred

Docker runtime validation in Linux CI, backup and restore workflow, PWA, CSP nonce enforcement, complex UI, and all hosting or deployment integrations remain outside this cut. `GHSA-vfj7-8cjw-p6xm` remains open: its only available `braces` release is affected and the advisory publishes no patched version.
