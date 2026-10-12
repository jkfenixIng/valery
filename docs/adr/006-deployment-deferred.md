# ADR-006: Defer deployment integration explicitly

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: delivery, deployment

## Context
The approved scope is local technical foundation. Git pushes to `develop` are a backup mechanism, not deployments.

## Decision
Do not add hosting, VPS, Neon, Docker, or deployment automation in this cut. CI runs validation gates only.

## Alternatives considered
- Deploying from CI now: rejected because no hosting or runtime integration was approved.

## Consequences
The repository includes no deployment workflow. A later deployment decision requires a dedicated ADR and slice.

## Verification
Workflow inspection confirms CI contains only install and verification steps.
