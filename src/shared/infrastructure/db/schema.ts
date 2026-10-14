import { randomUUID } from 'node:crypto';

import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

const appId = () => uuid('id').$defaultFn(randomUUID).primaryKey();
const positiveMoney = (column: unknown) => sql`${column} >= 0`;
const positiveQuantity = (column: unknown) => sql`${column} > 0`;

export const users = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  twoFactorEnabled: boolean('two_factor_enabled').notNull().default(false),
});

export const sessions = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
});

export const accounts = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verifications = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const twoFactors = pgTable('two_factor', {
  id: text('id').primaryKey(),
  secret: text('secret').notNull(),
  backupCodes: text('backup_codes').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  verified: boolean('verified').notNull().default(true),
  failedVerificationCount: integer('failed_verification_count')
    .notNull()
    .default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

export const rateLimits = pgTable('rate_limit', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  count: integer('count').notNull(),
  lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

export const authLockouts = pgTable('auth_lockouts', {
  subjectHash: text('subject_hash').primaryKey(),
  failures: integer('failures').notNull(),
  lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: appId(),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    eventType: text('event_type').notNull(),
    outcome: text('outcome').notNull(),
    actorUserId: text('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    subjectHash: text('subject_hash'),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (table) => [
    check(
      'audit_logs_outcome_valid',
      sql`${table.outcome} IN ('success', 'failure', 'blocked')`,
    ),
  ],
);

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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Archive marker; archived rows stay for history and are never listed. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Serves the active catalog query: WHERE deleted_at IS NULL ORDER BY name.
    index('supplies_active_name_idx')
      .on(table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    check(
      'supplies_unit_cost_cop_nonnegative',
      positiveMoney(table.unitCostCop),
    ),
    check('supplies_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check('supplies_unit_nonempty', sql`length(trim(${table.unit})) > 0`),
    // Unchanged policy: covers archived rows too, so an archived name cannot
    // be reused in the same category.
    unique('supplies_category_id_name_unique').on(table.categoryId, table.name),
  ],
);

/**
 * Exact positive rational as `numerator/denominator` text. Unreduced forms
 * (`500/1000`) are accepted; the application normalizes through `Quantity`.
 */
const canonicalFraction = (column: unknown) =>
  sql`${column} ~ '^[1-9][0-9]*/[1-9][0-9]*$'`;

const timestamps = () => ({
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: appId(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    description: text('description').notNull(),
    /**
     * Legacy rows predate calculation types; they all carry a manual sale
     * price, so the default classifies them as fixed-price products.
     */
    calculationType: text('calculation_type').notNull().default('fixed_price'),
    /** Manual price of a `fixed_price` product; null for calculated types. */
    salePriceCop: bigint('sale_price_cop', { mode: 'bigint' }),
    /** Optional own margin; null uses the default margin from settings. */
    marginBps: integer('margin_bps'),
    baseLaborMinutes: integer('base_labor_minutes').notNull().default(0),
    /** Whole portions a recipe yields; the domain requires it for recipes. */
    recipeYieldPortions: integer('recipe_yield_portions'),
    /** Stored flag only; the public catalog is not built yet. */
    isPublished: boolean('is_published').notNull().default(false),
    ...timestamps(),
    /** Archive marker; archived rows stay for history and are never listed. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Serves the active catalog query: WHERE deleted_at IS NULL ORDER BY name.
    index('products_active_name_idx')
      .on(table.name)
      .where(sql`${table.deletedAt} IS NULL`),
    // The unique (category_id, name) index already covers category lookups.
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
    check(
      'products_calculation_type_valid',
      sql`${table.calculationType} IN ('recipe', 'base_with_extras', 'bundle', 'fixed_price')`,
    ),
    check(
      'products_fixed_price_has_sale_price',
      sql`${table.calculationType} <> 'fixed_price' OR ${table.salePriceCop} IS NOT NULL`,
    ),
    check(
      'products_base_labor_minutes_nonnegative',
      sql`${table.baseLaborMinutes} >= 0`,
    ),
    check(
      'products_recipe_yield_portions_positive',
      sql`${table.recipeYieldPortions} IS NULL OR ${table.recipeYieldPortions} > 0`,
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
    /**
     * Compatibility only: `numeric(14,3)` cannot hold 1/3. New writes leave
     * it null and reads never rebuild a `Quantity` from it.
     */
    quantity: numeric('quantity', { precision: 14, scale: 3 }),
    /** Authoritative exact quantity; legacy rows backfilled by 0005. */
    quantityFraction: text('quantity_fraction').notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    index('product_components_product_id_idx').on(table.productId),
    index('product_components_supply_id_idx').on(table.supplyId),
    index('product_components_component_product_id_idx').on(
      table.componentProductId,
    ),
    check(
      'product_components_quantity_positive',
      positiveQuantity(table.quantity),
    ),
    check(
      'product_components_quantity_fraction_canonical',
      canonicalFraction(table.quantityFraction),
    ),
    check(
      'product_components_one_component_source',
      sql`(${table.supplyId} IS NOT NULL AND ${table.componentProductId} IS NULL) OR (${table.supplyId} IS NULL AND ${table.componentProductId} IS NOT NULL)`,
    ),
  ],
);

export const optionGroups = pgTable(
  'option_groups',
  {
    id: appId(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    selection: text('selection').notNull(),
    isRequired: boolean('is_required').notNull(),
    isVisible: boolean('is_visible').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    index('option_groups_product_id_idx').on(table.productId),
    unique('option_groups_product_id_name_unique').on(
      table.productId,
      table.name,
    ),
    check('option_groups_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check(
      'option_groups_selection_valid',
      sql`${table.selection} IN ('single', 'multiple')`,
    ),
  ],
);

export const optionValues = pgTable(
  'option_values',
  {
    id: appId(),
    optionGroupId: uuid('option_group_id')
      .notNull()
      .references(() => optionGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    extraMaterialCostCop: bigint('extra_material_cost_cop', {
      mode: 'bigint',
    }).notNull(),
    extraLaborMinutes: integer('extra_labor_minutes').notNull(),
    suggestedExtraPriceCop: bigint('suggested_extra_price_cop', {
      mode: 'bigint',
    }),
    position: integer('position').notNull(),
  },
  (table) => [
    index('option_values_option_group_id_idx').on(table.optionGroupId),
    unique('option_values_option_group_id_name_unique').on(
      table.optionGroupId,
      table.name,
    ),
    check('option_values_name_nonempty', sql`length(trim(${table.name})) > 0`),
    check(
      'option_values_extra_material_cost_cop_nonnegative',
      positiveMoney(table.extraMaterialCostCop),
    ),
    check(
      'option_values_extra_labor_minutes_nonnegative',
      sql`${table.extraLaborMinutes} >= 0`,
    ),
    check(
      'option_values_suggested_extra_price_cop_nonnegative',
      positiveMoney(table.suggestedExtraPriceCop),
    ),
  ],
);

export const optionValueComponents = pgTable(
  'option_value_components',
  {
    id: appId(),
    optionValueId: uuid('option_value_id')
      .notNull()
      .references(() => optionValues.id, { onDelete: 'cascade' }),
    supplyId: uuid('supply_id')
      .notNull()
      .references(() => supplies.id),
    quantityFraction: text('quantity_fraction').notNull(),
    position: integer('position').notNull(),
  },
  (table) => [
    index('option_value_components_option_value_id_idx').on(
      table.optionValueId,
    ),
    index('option_value_components_supply_id_idx').on(table.supplyId),
    check(
      'option_value_components_quantity_fraction_canonical',
      canonicalFraction(table.quantityFraction),
    ),
  ],
);
