# ADR-009: Apply a strict nonce CSP for the local-first phase

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: security, local-first

## Context

Phase 0 needs browser protections and transparent vulnerability reporting without changing hosting, authentication, UI, PWA, or data infrastructure. Next.js development tooling requires `unsafe-eval`; production must not receive it. PWA and authentication require a strict CSP. HSTS is inappropriate before an HTTPS deployment exists.

## Decision

Use a Next.js 16 `proxy.ts` to generate a unique nonce per eligible request and propagate its CSP through both request and response headers. Keep a pure CSP factory in `src/config`; it accepts the environment and nonce, while only `src/config/env.ts` reads `process.env`. Apply static headers from `next.config.ts` without CSP duplication. The root layout awaits `connection()` so pages render dynamically and Next can inject the nonce. Permit `unsafe-eval` only in development; production permits neither `unsafe-inline` nor `unsafe-eval`. Keep `data:`/`blob:` image support. Add `SECURITY.md` and `public/.well-known/security.txt` with the approved private contact. Keep reproducible HTTP header smoke checks inside `verify`, including nonce uniqueness and production exclusions. Run the dependency audit and Gitleaks scan as dedicated CI steps on `develop` pushes and pull requests; retain an opt-in local Gitleaks command that requires an installed binary.

## Alternatives considered

- Retaining static CSP with `unsafe-inline`: rejected because it blocks a strict CSP needed by PWA and authentication.
- Enabling HSTS now: rejected because no HTTPS host is approved.
- Adding Gitleaks to `verify`: rejected because the local gate must not require a binary that is not installed; CI runs the official pinned action instead.

## Consequences

Production CSP includes a unique request nonce and neither `unsafe-inline` nor `unsafe-eval`; development includes `unsafe-eval` for Next tooling. The nonce requires dynamic rendering, so static optimization is traded for strict script and style execution. No HSTS header is emitted. `scan:secrets` fails clearly until Gitleaks is installed. CI runs both `audit:dependencies` and the official pinned Gitleaks action while local `verify` remains independent of uninstalled tools.

## Verification

Unit tests assert environment-specific nonce CSP and HSTS absence. A production HTTP smoke test checks every critical emitted directive, two unique nonces, and rejects production `unsafe-inline` and `unsafe-eval`. `pnpm audit --audit-level=high` reports dependency advisories. CI runs the audit and Gitleaks checks only for `develop` pushes and pull requests.
