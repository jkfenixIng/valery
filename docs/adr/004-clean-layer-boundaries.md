# ADR-004: Enforce clean layer boundaries

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: architecture, quality

## Context
Business calculations and private data rules must survive framework and persistence changes.

## Decision
Keep domain pure, application dependent only on domain contracts, infrastructure outside presentation, and compose dependencies in `src/composition/container.ts`.

## Alternatives considered
- Feature code importing adapters directly: rejected because it couples use cases and UI to infrastructure.

## Consequences
Dependency-cruiser forbids invalid dependencies, cycles, and unresolved imports. A negative fixture proves the rule executes.

## Verification
`pnpm test:architecture` validates source and expects the invalid fixture to fail.
