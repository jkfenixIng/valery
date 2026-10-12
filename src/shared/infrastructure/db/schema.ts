import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  integer,
  numeric,
  pgTable,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const appId = () => uuid('id').$defaultFn(randomUUID).primaryKey();
const positiveMoney = (column: unknown) => sql`${column} >= 0`;
const positiveQuantity = (column: unknown) => sql`${column} > 0`;

export const settings = pgTable('settings', {
  id: appId(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
});

export const categories = pgTable('categories', {
  id: appId(),
  name: text('name').notNull().unique(),
});

export const supplies = pgTable(
  'supplies',
  {
    id: appId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    unit: text('unit').notNull(),
    unitCostCop: bigint('unit_cost_cop', { mode: 'bigint' }).notNull(),
  },
  (table) => [
    check(
      'supplies_unit_cost_cop_nonnegative',
      positiveMoney(table.unitCostCop),
    ),
    check('supplies_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check('supplies_unit_nonempty', sql`length(trim(${table.unit})) > 0`),
    unique('supplies_category_id_name_unique').on(table.categoryId, table.name),
  ],
);

export const products = pgTable(
  'products',
  {
    id: appId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    salePriceCop: bigint('sale_price_cop', { mode: 'bigint' }).notNull(),
    marginBps: integer('margin_bps').notNull(),
  },
  (table) => [
    check(
      'products_sale_price_cop_nonnegative',
      positiveMoney(table.salePriceCop),
    ),
    check(
      'products_margin_bps_in_range',
      sql`${table.marginBps} BETWEEN 0 AND 10000`,
    ),
    check('products_name_nonempty', sql`length(trim(${table.name})) > 0`),
    unique('products_category_id_name_unique').on(table.categoryId, table.name),
    check(
      'products_description_nonempty',
      sql`length(trim(${table.description})) > 0`,
    ),
  ],
);

export const productComponents = pgTable(
  'product_components',
  {
    id: appId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    supplyId: uuid('supply_id').references(() => supplies.id),
    componentProductId: uuid('component_product_id').references(
      () => products.id,
    ),
    quantity: numeric('quantity', { precision: 14, scale: 3 }).notNull(),
  },
  (table) => [
    check(
      'product_components_quantity_positive',
      positiveQuantity(table.quantity),
    ),
    check(
      'product_components_one_component_source',
      sql`(${table.supplyId} IS NOT NULL AND ${table.componentProductId} IS NULL) OR (${table.supplyId} IS NULL AND ${table.componentProductId} IS NOT NULL)`,
    ),
  ],
);
