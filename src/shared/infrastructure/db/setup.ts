import { closeDatabase, database } from './client';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { config, hasAdminSeedConfig } from '../../../config/env';

import { seedDatabase } from './seed';

const run = async (): Promise<void> => {
  try {
    await migrate(database, { migrationsFolder: 'drizzle' });
    await seedDatabase(database);
    if (hasAdminSeedConfig(config)) {
      const { seedAdmin } =
        await import('../../../modules/auth/infrastructure/seed-admin');
      await seedAdmin();
    }
  } finally {
    await closeDatabase();
  }
};

void run();
