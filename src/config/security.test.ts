import { describe, expect, it } from 'vitest';

import {
  createContentSecurityPolicy,
  createSecurityHeaders,
} from './security';

describe('security headers', () => {
  it('creates a strict nonce CSP without production inline or eval sources', () => {
    const policy = createContentSecurityPolicy('production', 'request-nonce');

    expect(policy).toContain(
      "script-src 'self' 'nonce-request-nonce' 'strict-dynamic'",
    );
    expect(policy).toContain("style-src 'self' 'nonce-request-nonce'");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it('includes unsafe-eval only in development', () => {
    const developmentPolicy = createContentSecurityPolicy(
      'development',
      'request-nonce',
    );

    expect(developmentPolicy).toContain("'unsafe-eval'");
    expect(developmentPolicy).not.toContain("'unsafe-inline'");
  });

  it('uses static browser protections without CSP or HSTS', () => {
    const headers = createSecurityHeaders();

    expect(headers).toContainEqual({
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    });
    expect(headers).toContainEqual({
      key: 'X-Frame-Options',
      value: 'DENY',
    });
    expect(
      headers.some((header) => header.key === 'Content-Security-Policy'),
    ).toBe(false);
    expect(headers.some((header) => header.key === 'Strict-Transport-Security')).toBe(
      false,
    );
  });
});
