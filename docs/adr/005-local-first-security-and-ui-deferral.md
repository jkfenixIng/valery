# ADR-005: Keep the foundation local-first and defer UI/PWA

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: security, scope

## Context
The current cut establishes safe local development rather than product flows.

## Decision
Centralize environment validation in `src/config`; keep database configuration optional until an adapter exists; defer complex UI, PWA, auth, database, and Docker.

## Alternatives considered
- Requiring `DATABASE_URL` at startup: rejected because no adapter currently needs it.
- Adding a PWA and design system now: rejected because they do not protect the technical foundation.

## Consequences
Only `src/config` reads `process.env`; `.env.example` contains no secret. `requireDatabaseUrl` is the explicit future gate.

## Verification
Configuration tests confirm local startup works and the missing future database URL fails controllably.
