import { describe, expect, it } from 'vitest';

import {
  ConfigurationError,
  createConfig,
  hasDatabaseUrl,
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

  it('rejects non-PostgreSQL database URLs', () => {
    expect(() =>
      createConfig({ DATABASE_URL: 'mysql://localhost:3306/valery_dev' }),
    ).toThrow(ConfigurationError);
  });
});
