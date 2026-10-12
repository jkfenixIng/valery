# ADR-001: Use Next.js App Router with strict TypeScript

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: framework, architecture

## Context
The local-first foundation needs a typed web application shell while business rules remain framework-independent.

## Decision
Use Next.js App Router, TypeScript strict mode, pnpm, Tailwind CSS, and standalone output.

## Alternatives considered
- A client-only React app: rejected because later server boundaries are required.
- A framework-free server: rejected because it adds setup work without a current benefit.

## Consequences
Server Components remain the default when presentation starts. The standalone build is available, but deployment is deferred.

## Verification
`pnpm build` produces a successful Next.js build.
