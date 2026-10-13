import { fileURLToPath } from 'node:url';

import {
  config,
  hasAdminSeedConfig,
  requireAdminSeedConfig,
} from '@/config/env';
import { closeDatabase } from '@/shared/infrastructure/db/client';

import { createAuth } from './auth';

export const seedAdmin = async (): Promise<boolean> => {
  if (!hasAdminSeedConfig(config)) {
    return false;
  }

  const { email, password } = requireAdminSeedConfig(config);
  const context = await createAuth(config).$context;
  const existing = await context.internalAdapter.findUserByEmail(email);
  if (existing) {
    return false;
  }

  const user = await context.internalAdapter.createUser(
    { email, emailVerified: true, name: 'Administrador' },
    { method: 'admin' },
  );
  await context.internalAdapter.linkAccount({
    accountId: user.id,
    password: await context.password.hash(password),
    providerId: 'credential',
    userId: user.id,
  });
  return true;
};

const run = async (): Promise<void> => {
  try {
    await seedAdmin();
  } finally {
    await closeDatabase();
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void run();
}
