import { closeDatabase, database } from './client';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { seedDatabase } from './seed';

const run = async (): Promise<void> => {
  await migrate(database, { migrationsFolder: 'drizzle' });
  await seedDatabase(database);
  await closeDatabase();
};

void run();
