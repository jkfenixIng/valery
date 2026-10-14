import { readFileSync } from 'node:fs';

import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  accounts,
  auditLogs,
  authLockouts,
  categories,
  optionGroups,
  optionValueComponents,
  optionValues,
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
        optionGroups,
        optionValues,
        optionValueComponents,
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
      'optionGroups',
      'optionValues',
      'optionValueComponents',
    ]);
  });

  const dialect = new PgDialect();
  const checks = (table: Parameters<typeof getTableConfig>[0]) =>
    Object.fromEntries(
      getTableConfig(table).checks.map((check) => [
        check.name,
        dialect.sqlToQuery(check.value).sql,
      ]),
    );
  const column = (table: Parameters<typeof getTableConfig>[0], name: string) =>
    getTableConfig(table).columns.find((candidate) => candidate.name === name);
  const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
    getTableConfig(table).indexes.map((index) => index.config.name);

  it('stores exact component quantities as authoritative canonical fraction text', () => {
    for (const table of [productComponents, optionValueComponents]) {
      expect(column(table, 'quantity_fraction')).toMatchObject({
        columnType: 'PgText',
        notNull: true,
      });
    }
    expect(column(productComponents, 'quantity')?.notNull).toBe(false);
    expect(
      checks(productComponents).product_components_quantity_fraction_canonical,
    ).toContain(`~ '^[1-9][0-9]*/[1-9][0-9]*$'`);
    expect(
      checks(optionValueComponents)
        .option_value_components_quantity_fraction_canonical,
    ).toContain(`~ '^[1-9][0-9]*/[1-9][0-9]*$'`);
  });

  it('constrains calculation types and recipe yield while leaving the requirement to the domain', () => {
    const productChecks = checks(products);

    expect(productChecks.products_calculation_type_valid).toContain(
      "('recipe', 'base_with_extras', 'bundle', 'fixed_price')",
    );
    expect(productChecks.products_recipe_yield_portions_positive).toBe(
      '"products"."recipe_yield_portions" IS NULL OR "products"."recipe_yield_portions" > 0',
    );
    expect(column(products, 'recipe_yield_portions')?.notNull).toBe(false);
    expect(column(products, 'is_published')?.notNull).toBe(true);
    expect(column(products, 'deleted_at')?.notNull).toBe(false);
  });

  it('indexes active products and every product foreign key', () => {
    expect(indexNames(products)).toEqual(['products_active_name_idx']);
    expect(indexNames(productComponents)).toEqual([
      'product_components_product_id_idx',
      'product_components_supply_id_idx',
      'product_components_component_product_id_idx',
    ]);
    expect(indexNames(optionGroups)).toEqual(['option_groups_product_id_idx']);
    expect(indexNames(optionValues)).toEqual([
      'option_values_option_group_id_idx',
    ]);
    expect(indexNames(optionValueComponents)).toEqual([
      'option_value_components_option_value_id_idx',
      'option_value_components_supply_id_idx',
    ]);
  });

  it('backfills legacy quantities as exact decimal rationals in a data-only migration', () => {
    const statements = readFileSync(
      new URL(
        '../../../../drizzle/0005_backfill_component_quantity_fraction.sql',
        import.meta.url,
      ),
      'utf8',
    )
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('--'))
      .join('\n');

    expect(statements).toMatch(/^UPDATE "product_components"/);
    expect(statements).toContain(
      `("quantity" * 1000)::bigint::text || '/1000'`,
    );
    expect(statements).not.toMatch(/\b(ALTER|CREATE|DROP)\b/i);
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
