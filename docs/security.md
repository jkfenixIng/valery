# Security

Phase 0 is local-first. It has no approved public hosting, deployment, or response-time commitment. Report suspected vulnerabilities privately to [jkfenix95@hotmail.com](mailto:jkfenix95@hotmail.com), as described in [SECURITY.md](../SECURITY.md).

## Security model

| Area                        | Current control                                                                                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser headers             | A request nonce CSP is emitted through the Next.js proxy. Production permits neither `unsafe-inline` nor `unsafe-eval`; development permits `unsafe-eval` only for Next tooling. Framing, MIME-sniffing, referrer, and restrictive permissions protections are also emitted. |
| Authentication              | One seeded administrator only; public sign-up is disabled. Passwords use argon2id. TOTP is mandatory before `/admin` access.                                                                                                                                                 |
| Recovery and abuse controls | TOTP has ten single-use backup codes and a separate five-failure, 15-minute lockout. Password sign-in locks an account after five failures in 15 minutes for 15 minutes. Better Auth rate limits sign-in and TOTP endpoints to five requests per 60 seconds.                 |
| Sessions and access         | Sessions expire after 8 hours and refresh after 1 hour. `/admin` and private API routes are protected in depth.                                                                                                                                                              |
| Audit trail                 | `audit_logs` records security outcomes without email, passwords, TOTP secrets, recovery codes, raw IP addresses, or user agents.                                                                                                                                             |

See [ADR-009](./adr/009-static-security-baseline.md) for CSP and header details and [ADR-010](./adr/010-better-auth-admin-totp.md) for authentication details.

## Secrets and dependency hygiene

- Keep `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `DATABASE_URL` only in untracked `.env.local`; never log or commit them.
- Run `corepack pnpm audit:dependencies` to detect high and critical dependency advisories. CI runs this audit for `develop` pushes and pull requests.
- Run `corepack pnpm scan:secrets` when Gitleaks is installed. CI runs the pinned Gitleaks action for `develop` pushes and pull requests.
- The `braces` advisory `GHSA-vfj7-8cjw-p6xm` is deferred: the advisory has no patched release. Review it when an upstream patch is available.

## Incident response

1. **Detect.** Preserve the report, relevant timestamps, and non-sensitive audit evidence. Do not copy secrets, credentials, recovery codes, or personal data into tickets.
2. **Contain.** Stop affected access. Revoke active sessions by deleting the affected user's rows from `session` in a controlled PostgreSQL maintenance session. Rotate `BETTER_AUTH_SECRET` when cookie signing or TOTP/recovery-code encryption may be exposed; this invalidates existing authentication state. Phase 0 has no shareable links to revoke.
3. **Eradicate.** Identify and remove the cause, including vulnerable code, compromised credentials, or unsafe configuration. Apply reviewed dependency updates when available.
4. **Recover.** Set the replacement secret in untracked `.env.local`, restore access through the administrator recovery runbook, and restore PostgreSQL only from a verified backup once a hosting backup process exists. Verify the security headers and authentication flow before resuming normal use.
5. **Review.** Document the timeline, impact, corrective actions, and follow-up owner. Notify affected customers when appropriate. If personal data may have been exposed, consult the obligation to report to Colombia's Superintendencia de Industria y Comercio.

## Deferred

- HSTS remains disabled until an HTTPS hosting decision is approved; it is not appropriate for the local-first phase.
- Backup, restore, retention, and recovery verification remain pending hosting and implementation. See [backup-and-ci-pending.md](./backup-and-ci-pending.md).
