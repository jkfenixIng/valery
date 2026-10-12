# ADR-008: Enable the local UI system

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: ui, design-system, local-development

## Context

Phase 0 needs a local, accessible interface foundation before business flows exist. The product requires light, dark, and system theme preferences; semantic CSS tokens; a shared UI kit; and a `/design` route that exposes component states.

## Decision

Use `next-themes` with class-based themes and system preference enabled. Keep semantic tokens in `src/app/globals.css`, and keep reusable presentational primitives in `src/shared/ui`: `GlassCard`, `GlassButton`, `Field`, `Sheet`, `BottomNav`, and the theme provider/toggle. The `/design` route is the local reference surface for normal, hover, focus, disabled, error, and loading states.

No hosting, PWA, authentication, business functionality, database work, security-header work, CI changes, or visual regression suite is included in this decision.

## Alternatives considered

- Theme state managed manually with React context: rejected because `next-themes` handles persisted system-aware theme selection and hydration concerns.
- Raw palette values in individual components: rejected because semantic tokens preserve meaning across both themes.
- A third-party component suite: rejected because this cut needs only the specified primitives and should avoid broader dependency surface.

## Consequences

Presentation code imports reusable UI only from `src/shared/ui`; it does not cross module or infrastructure boundaries. UI controls use native semantic elements, visible focus, error semantics, reduced-motion handling, and a minimum 44px touch target. Versions are pinned exactly in `package.json`.

## Verification

`cn` has a focused unit test for conditional class assembly and Tailwind conflict resolution. `pnpm verify` validates lint, TypeScript, tests, architecture boundaries, and production build.
