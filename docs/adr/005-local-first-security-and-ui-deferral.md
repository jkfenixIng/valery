# ADR-005: Keep the foundation local-first and defer UI/PWA

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: security, scope

## Context

The current cut establishes safe local development rather than product flows.

## Decision

Centralize environment validation in `src/config`; keep `DATABASE_URL` optional for presentation-only startup, but require a validated PostgreSQL URL when the database adapter loads. Defer complex UI, PWA, and auth. PostgreSQL persistence is implemented by ADR-002; Compose remains a CI portability contract rather than local Docker runtime.

## Alternatives considered

- Requiring `DATABASE_URL` at every application startup: rejected because the adapter is not composed into product flows yet.
- Adding a PWA and design system now: rejected because they do not protect the technical foundation.

## Consequences

Only `src/config` reads `process.env`; `.env.example` contains no real secret. `requireDatabaseUrl` gates the infrastructure adapter explicitly.

## Verification

Configuration tests validate accepted PostgreSQL URLs and controlled failures for missing or non-PostgreSQL values.
