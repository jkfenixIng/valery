export type SecurityEnvironment = 'development' | 'production' | 'test';

export type SecurityHeader = Readonly<{
  key: string;
  value: string;
}>;

export const createContentSecurityPolicy = (
  environment: SecurityEnvironment,
  nonce: string,
): string => {
  const developmentScriptSource =
    environment === 'development' ? " 'unsafe-eval'" : '';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${developmentScriptSource}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
};

export const createSecurityHeaders = (): readonly SecurityHeader[] => [
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
