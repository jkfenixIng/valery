# Secret rotation

Use this procedure after suspected exposure of `BETTER_AUTH_SECRET`, an administrator password, or another configured secret. Do not place secret values in notes, commits, or logs.

## `BETTER_AUTH_SECRET`

1. Contain the incident as described in [Security](../security.md).
2. Generate a replacement secret with at least 32 random characters and update untracked `.env.local`.
3. Restart the local application process.
4. Treat all existing sessions, signed authentication state, TOTP secrets, and backup codes as invalid: Better Auth encrypts TOTP secrets and backup codes with this secret. Reset and re-enroll TOTP through the "All backup codes lost" procedure in [administrator access recovery](./admin-access-recovery.md).
5. Run `corepack pnpm test:security-headers`; with a configured database and authentication variables, run `corepack pnpm test:e2e`.

## Administrator password

Phase 0 has no password-change screen. The Better Auth `/api/auth/change-password` endpoint is available to an authenticated administrator and its outcome is recorded as `auth.password.changed` in `audit_logs`.

1. If access is not available, complete [administrator access recovery](./admin-access-recovery.md) first.
2. Change the password through that endpoint with a new password of at least 12 characters.
3. Update `ADMIN_PASSWORD` in untracked `.env.local`; `db:seed:admin` does not change an existing administrator.
4. Review non-sensitive `audit_logs` evidence and record the intervention outside the application.

For secrets discovered in tracked files, remove the value, rotate it at its source, and run `corepack pnpm scan:secrets` when Gitleaks is installed.
