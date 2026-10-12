# ADR-009: Apply a static security baseline for the local-first phase

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: security, local-first

## Context

Phase 0 needs browser protections and transparent vulnerability reporting without changing hosting, authentication, UI, PWA, or data infrastructure. Next.js development tooling requires `unsafe-eval`; production must not receive it. HSTS is inappropriate before an HTTPS deployment exists.

## Decision

Use Next.js global headers from a testable `src/config` policy. Apply a CSP with self-only sources and narrowly scoped `data:`/`blob:` image support. Permit `unsafe-eval` only when `NODE_ENV` is `development`; preserve Next.js-compatible `unsafe-inline` for framework rendering. Add `SECURITY.md` and `public/.well-known/security.txt` with the approved private contact. Keep the reproducible HTTP header smoke checks inside `verify`, including every emitted critical CSP directive and production exclusion of `unsafe-eval`. Run the dependency audit and Gitleaks scan as dedicated CI steps on `develop` pushes and pull requests; retain an opt-in local Gitleaks command that requires an installed binary.

## Alternatives considered

- Per-request nonce CSP through Next proxy: deferred because it requires a rendering/runtime behavior change beyond this static baseline.
- Enabling HSTS now: rejected because no HTTPS host is approved.
- Adding Gitleaks to `verify`: rejected because the local gate must not require a binary that is not installed; CI runs the official pinned action instead.

## Consequences

Production CSP does not include `unsafe-eval`; development does. No HSTS header is emitted. `scan:secrets` fails clearly until Gitleaks is installed. CI runs both `audit:dependencies` and the official pinned Gitleaks action while local `verify` remains independent of uninstalled tools. CSP nonces remain a separate pending runtime/rendering change; this static baseline intentionally retains `unsafe-inline`.

## Verification

Unit tests assert environment-specific CSP and HSTS absence. A production HTTP smoke test checks every critical emitted directive and rejects production `unsafe-eval`. `pnpm audit --audit-level=high` reports dependency advisories. CI runs the audit and Gitleaks checks only for `develop` pushes and pull requests.
