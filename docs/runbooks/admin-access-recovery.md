# Administrator access recovery

Use this procedure only for the responsible administrator. Record the intervention outside the application without storing secrets or codes.

## Lost TOTP device

1. Sign in with the administrator email and password.
2. At the TOTP prompt, use one unused backup code.
3. Enroll a replacement authenticator at `/auth/two-factor/setup` and store its newly issued backup codes offline.

## All backup codes lost

1. In a controlled PostgreSQL maintenance session, identify the administrator in `"user"` by email.
2. Delete that user's row from `two_factor`.
3. Set that user's `two_factor_enabled` value to `false` in `"user"`.
4. Sign in with the administrator email and password, then enroll TOTP again at `/auth/two-factor/setup`.
5. Rotate the administrator password after recovery.

This is the recovery procedure defined in the [README](../../README.md) and [ADR-010](../adr/010-better-auth-admin-totp.md). Do not delete the user, modify backup-code ciphertext, or log the TOTP secret or recovery codes.
