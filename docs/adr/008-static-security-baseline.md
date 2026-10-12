# ADR-008: Apply a static security baseline for the local-first phase

- **Status**: Accepted
- **Date**: 2026-10-12
- **Deciders**: Valery project
- **Tags**: security, local-first

## Context

Phase 0 needs browser protections and transparent vulnerability reporting without changing hosting, authentication, UI, PWA, or data infrastructure. Next.js development tooling requires `unsafe-eval`; production must not receive it. HSTS is inappropriate before an HTTPS deployment exists.

## Decision

Use Next.js global headers from a testable `src/config` policy. Apply a CSP with self-only sources and narrowly scoped `data:`/`blob:` image support. Permit `unsafe-eval` only when `NODE_ENV` is `development`; preserve Next.js-compatible `unsafe-inline` for framework rendering. Add `SECURITY.md` and `public/.well-known/security.txt` with the approved private contact. Add dependency audit and an opt-in Gitleaks scan configuration; keep only reproducible HTTP header smoke checks inside `verify`. The audit remains an explicit script because the current dependency graph has an unresolved high advisory.

## Alternatives considered

- Per-request nonce CSP through Next proxy: deferred because it requires a rendering/runtime behavior change beyond this static baseline.
- Enabling HSTS now: rejected because no HTTPS host is approved.
- Adding Gitleaks to `verify`: rejected because the binary is not currently provisioned reproducibly on Windows or CI.

## Consequences

Production CSP does not include `unsafe-eval`; development does. No HSTS header is emitted. `scan:secrets` fails clearly until Gitleaks is installed. The explicit dependency audit fails for high or critical advisories; it stays outside `verify` until the current high advisory has a remediable version.

## Verification

Unit tests assert environment-specific CSP and HSTS absence. A production HTTP smoke test checks the emitted headers. `pnpm audit --audit-level=high` reports dependency advisories.
