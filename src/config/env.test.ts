import { describe, expect, it } from 'vitest';

import { ConfigurationError, createConfig, requireDatabaseUrl } from './env';

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
  });

  it('rejects non-PostgreSQL database URLs', () => {
    expect(() =>
      createConfig({ DATABASE_URL: 'mysql://localhost:3306/valery_dev' }),
    ).toThrow(ConfigurationError);
  });
});
