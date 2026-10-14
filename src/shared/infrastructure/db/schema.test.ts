import { getTableConfig } from 'drizzle-orm/pg-core';
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

  it('tracks supply lifecycle without changing the category-name uniqueness policy', () => {
    const config = getTableConfig(supplies);

    expect(config.columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['created_at', 'updated_at', 'deleted_at']),
    );
    expect(
      config.columns.find((column) => column.name === 'deleted_at')?.notNull,
    ).toBe(false);
    expect(config.indexes.map((index) => index.config.name)).toEqual([
      'supplies_active_name_idx',
    ]);
    expect(
      config.uniqueConstraints.map((constraint) => ({
        name: constraint.name,
        columns: constraint.columns.map((column) => column.name),
      })),
    ).toEqual([
      {
        name: 'supplies_category_id_name_unique',
        columns: ['category_id', 'name'],
      },
    ]);
  });
});
