import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { closeDatabase, database } from './client';

const run = async (): Promise<void> => {
  await migrate(database, { migrationsFolder: 'drizzle' });
  await closeDatabase();
};

void run();
