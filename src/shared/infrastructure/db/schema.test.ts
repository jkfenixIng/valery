import { describe, expect, it } from 'vitest';

import {
  accounts,
  auditLogs,
  authLockouts,
  categories,
  productComponents,
  products,
  rateLimits,
  sessions,
  settings,
  supplies,
  twoFactors,
  users,
  verifications,
} from './schema';

describe('database schema', () => {
  it('defines the F0 persistence tables', () => {
    expect(
      Object.keys({
        users,
        sessions,
        accounts,
        verifications,
        twoFactors,
        rateLimits,
        authLockouts,
        auditLogs,
        settings,
        categories,
        supplies,
        products,
        productComponents,
      }),
    ).toEqual([
      'users',
      'sessions',
      'accounts',
      'verifications',
      'twoFactors',
      'rateLimits',
      'authLockouts',
      'auditLogs',
      'settings',
      'categories',
      'supplies',
      'products',
      'productComponents',
    ]);
  });
});
