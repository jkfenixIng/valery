import { defineConfig } from 'drizzle-kit';

import { config, hasDatabaseUrl } from './src/config/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/infrastructure/db/schema.ts',
  out: './drizzle',
  ...(hasDatabaseUrl(config)
    ? { dbCredentials: { url: config.DATABASE_URL } }
    : {}),
});
