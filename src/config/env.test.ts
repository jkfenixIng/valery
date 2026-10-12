import { describe, expect, it } from 'vitest';

import { ConfigurationError, createConfig, requireDatabaseUrl } from './env';

describe('environment configuration', () => {
  it('allows local startup without a database URL before database integration exists', () => {
    expect(createConfig({ NODE_ENV: 'test' }).DATABASE_URL).toBeUndefined();
  });

  it('fails in a controlled way when future database integration requires a missing URL', () => {
    const config = createConfig({ NODE_ENV: 'test' });

    expect(() => requireDatabaseUrl(config)).toThrow(ConfigurationError);
  });
});
