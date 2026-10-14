import { expect, test, type Page } from '@playwright/test';
import { TOTP } from 'otpauth';

import { config, requireEndToEndConfig } from '../../src/config/env';

const {
  baseUrl,
  email: adminEmail,
  password: adminPassword,
} = requireEndToEndConfig(config);
const genericError = 'Correo o contraseña inválidos.';

test.describe.configure({ mode: 'serial' });

const signIn = async (page: Page, email: string, password: string) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
};

// Better Auth's otpauth URI carries the shared secret as base32.
const totpCode = (base32Secret: string) =>
  new TOTP({ secret: base32Secret }).generate();

let secret = '';
let backupCodes: string[] = [];

test('redirects an anonymous admin request to sign in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test('rejects an anonymous private route handler', async ({ request }) => {
  expect((await request.get('/api/admin/session')).status()).toBe(401);
});

test('returns the same error for a wrong password and an unknown account', async ({
  page,
}) => {
  await signIn(page, adminEmail, 'definitely-the-wrong-password');
  await expect(page.getByRole('alert')).toHaveText(genericError);
  await signIn(
    page,
    `unknown-${Date.now()}@example.test`,
    'definitely-the-wrong-password',
  );
  await expect(page.getByRole('alert')).toHaveText(genericError);
});

test('enrolls TOTP and reaches the admin panel', async ({ page }) => {
  await signIn(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/auth\/two-factor\/setup$/);
  await page.getByLabel('Contraseña').fill(adminPassword);
  await page
    .getByRole('button', { name: 'Generar código de configuración' })
    .click();

  secret = (await page.getByTestId('totp-secret').textContent()) ?? '';
  backupCodes = await page.getByTestId('backup-code').allTextContents();
  expect(secret).not.toBe('');
  expect(backupCodes).toHaveLength(10);

  await page.getByLabel('Código de seis dígitos').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Activar verificación' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
});

test('accepts each backup code only once', async ({ page }) => {
  const [code] = backupCodes;
  test.skip(!code, 'TOTP enrollment did not produce backup codes.');

  await signIn(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/auth\/two-factor$/);
  await page.getByLabel('Código de recuperación').fill(code!);
  await page
    .getByRole('button', { name: 'Usar código de recuperación' })
    .click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();

  await signIn(page, adminEmail, adminPassword);
  await page.getByLabel('Código de recuperación').fill(code!);
  await page
    .getByRole('button', { name: 'Usar código de recuperación' })
    .click();
  await expect(page.getByRole('alert')).toHaveText(
    'Código de recuperación inválido.',
  );
});

// Runs last: it locks the only seeded administrator for 15 minutes, so a
// re-run must wait for the lock to expire.
test('locks an account after five failed passwords without revealing the lock', async ({
  request,
}) => {
  // A distinct forwarded IP per attempt keeps the per-IP rate limit (429) out
  // of the way, so only the per-account lockout can reject the final attempt.
  const ipBase = `10.${Date.now() % 250}.0`;
  const attempt = (password: string, host: number) =>
    request.post('/api/auth/sign-in/email', {
      data: { email: adminEmail, password },
      headers: { origin: baseUrl, 'x-forwarded-for': `${ipBase}.${host}` },
    });

  for (let failure = 1; failure <= 5; failure += 1) {
    expect(
      (await attempt('definitely-the-wrong-password', failure)).status(),
    ).toBe(401);
  }

  const locked = await attempt(adminPassword, 99);
  expect(locked.status()).toBe(401);
  expect((await locked.json()).message).toBe(genericError);
});
