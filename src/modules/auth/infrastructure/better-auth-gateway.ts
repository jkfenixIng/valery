import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies';
import { cookies, headers } from 'next/headers';

import type {
  AuthenticationGateway,
  SignInResult,
  TwoFactorEnrollment,
} from '../application/authentication';
import { secretFromTotpUri } from '../application/authentication';
import type { ValeryAuth } from './auth';

const forwardedHeaderNames = [
  'origin',
  'user-agent',
  'x-forwarded-for',
] as const;

/**
 * Server actions dispatch real requests through the Better Auth router instead of
 * `auth.api.*`, because only the router applies the configured rate limits.
 */
export class BetterAuthGateway implements AuthenticationGateway {
  constructor(
    private readonly auth: ValeryAuth,
    private readonly baseUrl: string,
  ) {}

  private async request(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Response> {
    const [incoming, cookieStore] = await Promise.all([headers(), cookies()]);
    const outgoing = new Headers({ 'content-type': 'application/json' });
    for (const name of forwardedHeaderNames) {
      const value = incoming.get(name);
      if (value) outgoing.set(name, value);
    }
    const cookie = cookieStore.toString();
    if (cookie) outgoing.set('cookie', cookie);

    const response = await this.auth.handler(
      new Request(new URL(`/api/auth${path}`, this.baseUrl), {
        body: JSON.stringify(body ?? {}),
        headers: outgoing,
        method: 'POST',
      }),
    );

    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      for (const [name, attributes] of parseSetCookieHeader(setCookie)) {
        cookieStore.set(name, attributes.value, toCookieOptions(attributes));
      }
    }
    return response;
  }

  async enableTwoFactor(password: string): Promise<TwoFactorEnrollment | null> {
    const response = await this.request('/two-factor/enable', {
      method: 'totp',
      password,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      backupCodes?: string[];
      totpURI?: string;
    };
    if (!body.totpURI || !body.backupCodes) return null;
    return {
      backupCodes: body.backupCodes,
      secret: secretFromTotpUri(body.totpURI),
      totpUri: body.totpURI,
    };
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const response = await this.request('/sign-in/email', { email, password });
    if (!response.ok) return 'rejected';
    const body = (await response.json()) as { twoFactorRedirect?: boolean };
    return body.twoFactorRedirect ? 'two_factor_required' : 'signed_in';
  }

  async signOut(): Promise<void> {
    await this.request('/sign-out');
  }

  async verifyBackupCode(code: string): Promise<boolean> {
    return (await this.request('/two-factor/verify-backup-code', { code })).ok;
  }

  async verifyTotp(code: string): Promise<boolean> {
    return (await this.request('/two-factor/verify-totp', { code })).ok;
  }
}
