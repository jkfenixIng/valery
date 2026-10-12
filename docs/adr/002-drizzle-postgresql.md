# ADR-002: Adopt Drizzle for a future local PostgreSQL adapter

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: data, portability

## Context
Future persistence needs a typed PostgreSQL adapter without leaking ORM concerns into business code.

## Decision
Use Drizzle ORM and drizzle-kit only when the PostgreSQL local adapter is implemented, behind application ports.

## Alternatives considered
- SQL in domain or application: rejected because it violates layer boundaries.
- Adding an ORM now: rejected because no database behavior is in this slice.

## Consequences
No database package, schema, migration, or connection exists in ODD-0.1..0.4.

## Verification
Dependency-cruiser prohibits ORM imports from domain and application.
