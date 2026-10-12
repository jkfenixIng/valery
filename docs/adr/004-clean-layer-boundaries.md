# ADR-004: Enforce clean layer boundaries

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: architecture, quality

## Context

Business calculations and private data rules must survive framework and persistence changes.

## Decision

Keep domain pure, application dependent only on domain contracts, infrastructure outside presentation, and compose dependencies in `src/composition/container.ts`. App and presentation modules may not import shared or module domain, application, or infrastructure directly; their only permitted composition import is `src/composition/container.ts`.

## Alternatives considered

- Feature code importing adapters directly: rejected because it couples use cases and UI to infrastructure.

## Consequences

Dependency-cruiser forbids invalid dependencies, cycles, unresolved imports, and presentation-layer bypasses. Negative fixtures prove a domain Zod import, shared and module domain bypasses, and non-container composition imports fail; a positive fixture proves the container exception remains valid.

## Verification

`pnpm test:architecture` validates source, requires every negative fixture to fail with a dependency violation, and requires the allowed-container fixture to pass.
