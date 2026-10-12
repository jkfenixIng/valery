import { describe, expect, it } from 'vitest';

import { createSecurityHeaders } from './security';

describe('security headers', () => {
  it('includes unsafe-eval only in development', () => {
    const developmentPolicy = createSecurityHeaders('development').find(
      (header) => header.key === 'Content-Security-Policy',
    )?.value;
    const productionPolicy = createSecurityHeaders('production').find(
      (header) => header.key === 'Content-Security-Policy',
    )?.value;

    expect(developmentPolicy).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
    expect(productionPolicy).toContain("script-src 'self' 'unsafe-inline'");
    expect(productionPolicy).not.toContain("'unsafe-eval'");
  });

  it('uses baseline browser protections without HSTS', () => {
    const headers = createSecurityHeaders('production');

    expect(headers).toContainEqual({
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    });
    expect(headers).toContainEqual({
      key: 'X-Frame-Options',
      value: 'DENY',
    });
    expect(headers.some((header) => header.key === 'Strict-Transport-Security')).toBe(
      false,
    );
  });
});
