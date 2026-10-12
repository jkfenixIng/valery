import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { config, requireDatabaseUrl } from '../../../config/env';

const pool = new Pool({ connectionString: requireDatabaseUrl(config) });

export const database = drizzle({ client: pool });

export const closeDatabase = async (): Promise<void> => {
  await pool.end();
};
