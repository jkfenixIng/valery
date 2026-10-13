import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  createConfig,
  hasAdminSeedConfig,
  hasDatabaseUrl,
  requireAdminSeedConfig,
  requireAuthConfig,
  requireDatabaseUrl,
} from './env';

describe('environment configuration', () => {
  it('rejects a missing database URL when the database adapter requests it', () => {
    const config = createConfig({ NODE_ENV: 'test' });

    expect(() => requireDatabaseUrl(config)).toThrow(ConfigurationError);
  });

  it('accepts a PostgreSQL database URL', () => {
    const config = createConfig({
      DATABASE_URL:
        'postgresql://valery_dev:valery_dev@localhost:5432/valery_dev',
      NODE_ENV: 'test',
    });

    expect(requireDatabaseUrl(config)).toBe(
      'postgresql://valery_dev:valery_dev@localhost:5432/valery_dev',
    );
    expect(hasDatabaseUrl(config)).toBe(true);
  });

  it('reports that a missing database URL cannot run database workflows', () => {
    expect(hasDatabaseUrl(createConfig({ NODE_ENV: 'test' }))).toBe(false);
  });

  it('loads without authentication variables but rejects auth use without them', () => {
    const config = createConfig({ NODE_ENV: 'test' });

    expect(() => requireAuthConfig(config)).toThrow(
      'BETTER_AUTH_SECRET and BETTER_AUTH_URL are required',
    );
    expect(hasAdminSeedConfig(config)).toBe(false);
    expect(() => requireAdminSeedConfig(config)).toThrow(ConfigurationError);
  });

  it('accepts complete authentication configuration', () => {
    const config = createConfig({
      ADMIN_EMAIL: 'admin@example.test',
      ADMIN_PASSWORD: 'correct horse battery',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      BETTER_AUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'production',
    });

    expect(requireAuthConfig(config)).toEqual({
      baseUrl: 'http://localhost:3000',
      isProduction: true,
      secret: 'x'.repeat(32),
    });
    expect(hasAdminSeedConfig(config)).toBe(true);
  });

  it.each([
    { BETTER_AUTH_SECRET: 'short' },
    { BETTER_AUTH_URL: 'not-a-url' },
    { ADMIN_EMAIL: 'not-an-email' },
    { ADMIN_PASSWORD: 'too-short' },
  ])('rejects invalid authentication variables %o', (environment) => {
    expect(() => createConfig(environment)).toThrow(ConfigurationError);
  });

  it('rejects non-PostgreSQL database URLs', () => {
    expect(() =>
      createConfig({ DATABASE_URL: 'mysql://localhost:3306/valery_dev' }),
    ).toThrow(ConfigurationError);
  });
});
