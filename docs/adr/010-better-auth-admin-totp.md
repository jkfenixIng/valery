# ADR-010: Better Auth administrator with mandatory TOTP

- **Status**: Accepted
- **Date**: 2026-10-13
- **Deciders**: Valery project
- **Tags**: security, authentication
- **Supersedes**: ADR-003

## Context

F0-06 requires one seeded administrator, no public sign-up, mandatory TOTP, recovery codes, sign-in lockout, protected `/admin` routes, and an `audit_logs` table without personal data. The public shell, build, CI, and smoke tests must keep working without PostgreSQL or auth secrets.

## Decision

- Use `better-auth` 1.7.7 with the official `@better-auth/drizzle-adapter` 1.7.7 (`provider: "pg"`). Better Auth tables keep text ids; `audit_logs` uses the project `appId()` UUID.
- Email/password is enabled with `disableSignUp`, a 12-character minimum, and argon2id hashing through `@node-rs/argon2` 2.2.2 (memory 19 MiB, 2 passes).
- `db:seed:admin` idempotently creates the administrator from `ADMIN_EMAIL`/`ADMIN_PASSWORD`; `db:setup` runs it only when both variables exist. Secrets are never logged.
- The `twoFactor` plugin uses issuer `Valery`, 10 one-time backup codes, and its own 5-failure/15-minute verification lockout.
- Per-account password lockout: 5 consecutive failures within 15 minutes lock the account for 15 minutes; success resets the counter. Attempts are keyed by `HMAC-SHA256(lowercased email, BETTER_AUTH_SECRET)`. Unknown users, wrong passwords, and locked accounts receive the same `Correo o contraseña inválidos.` response. `LockoutPolicy` and `AuditEvent` are pure domain objects.
- Better Auth rate limiting is enabled with database storage, 5 requests per 60 s for `/sign-in/email` and `/two-factor/*`. Server actions dispatch real requests through the Better Auth router so these limits apply.
- Sessions last 8 h and refresh after 1 h; secure cookies in production; `baseURL` and `trustedOrigins` come from `BETTER_AUTH_URL`.
- `/admin` is protected in depth: the proxy redirects requests without a session cookie (optimistic), and the admin layout resolves access through the container (`anonymous` → `/auth/sign-in`, no TOTP → `/auth/two-factor/setup`). Private route handlers return 401.
- Auth is constructed lazily so modules without `DATABASE_URL` or auth variables still import, build, and pass smoke tests.
- `better-auth` and `@better-auth/*` imports are allowed only in `src/modules/auth/infrastructure`, enforced by dependency-cruiser with a negative fixture.

## Alternatives considered

- Auth.js: rejected; Better Auth is the PRD's first choice and ships TOTP, backup codes, and database rate limiting.
- Default scrypt hashing: rejected; argon2id built and ran on Windows/Next.
- Relying only on Better Auth rate limits: rejected; they are keyed by IP, while the PRD requires per-account lockout.

## Consequences

The schema gains Better Auth tables, `auth_lockouts`, and `audit_logs` (migration `0002`). Audit metadata accepts only `reason` and `method`; email, passwords, TOTP secrets, codes, raw IP, and user agent are never stored. Better Auth's own `session` table still stores IP and user agent for session management. Password reset is out of scope: recovery is handled by the responsible adult through the README runbook.

## Verification

Unit tests cover lockout, audit events, admin access, sign-in attempts, and auth configuration. Architecture checks reject Better Auth imports outside infrastructure. `test:e2e` (Playwright, requires PostgreSQL and auth env, not part of `verify`) covers anonymous redirects, 401 responses, generic errors, lockout, TOTP setup, and single-use backup codes.
