# ADR-004: Enforce clean layer boundaries

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: architecture, quality

## Context
Business calculations and private data rules must survive framework and persistence changes.

## Decision
Keep domain pure, application dependent only on domain contracts, infrastructure outside presentation, and compose dependencies in `src/composition/container.ts`. App and presentation modules may not import domain, application, or infrastructure directly.

## Alternatives considered
- Feature code importing adapters directly: rejected because it couples use cases and UI to infrastructure.

## Consequences
Dependency-cruiser forbids invalid dependencies, cycles, unresolved imports, and presentation-layer bypasses. Negative fixtures prove direct domain and application imports from app or presentation fail.

## Verification
`pnpm test:architecture` validates source and expects the invalid fixture to fail.
