import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import {
  auditLogs,
  optionGroups,
  optionValueComponents,
  optionValues,
  productComponents,
  products,
} from '@/shared/infrastructure/db/schema';

import { AuditEvent } from '../../auth/domain/audit-event';
import { Product, type ProductInput } from '../domain/product';
import { DrizzleProductRepository } from './drizzle-product-repository';

const dialect = new PgDialect();
const sql = (condition: unknown) => dialect.sqlToQuery(condition as never).sql;

const productId = '66666666-6666-4666-8666-666666666666';
const categoryId = '22222222-2222-4222-8222-222222222222';
const wax = '33333333-3333-4333-8333-333333333333';
const lavender = '44444444-4444-4444-8444-444444444444';

const audit = (
  eventType: 'product.created' | 'product.updated' | 'product.archived',
) =>
  AuditEvent.create({
    eventType,
    outcome: 'success',
    actorUserId: 'actor-id',
    metadata: { method: 'admin_product_form' },
  });

const candleInput: ProductInput = {
  name: 'Vela',
  description: 'Vela de soya.',
  calculationType: 'base_with_extras',
  baseLaborMinutes: 30,
  ownMarginBps: null,
  recipeYieldPortions: null,
  fixedPriceCop: null,
  isPublished: false,
  components: [{ kind: 'supply', referenceId: wax, quantity: '0.250' }],
  optionGroups: [
    {
      name: 'Aroma',
      selection: 'single',
      required: true,
      visible: true,
      values: [
        {
          name: 'Lavanda',
          extraMaterialCostCop: 1500,
          extraLaborMinutes: 5,
          suggestedExtraPriceCop: 4000,
          components: [{ supplyId: lavender, quantity: '1/3' }],
        },
      ],
    },
  ],
};

const candle = () => {
  const result = Product.create(candleInput);
  if (!result.ok) throw new Error('Invalid fixture.');
  return result.value;
};

const productRow = {
  id: productId,
  categoryId,
  name: 'Vela',
  description: 'Vela de soya.',
  calculationType: 'base_with_extras',
  salePriceCop: null,
  marginBps: null,
  baseLaborMinutes: 30,
  recipeYieldPortions: null,
  isPublished: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

/** Rows the store returns per table when the repository reads it back. */
const storedRows = new Map<unknown, unknown[]>([
  [
    productComponents,
    [
      {
        supplyId: wax,
        componentProductId: null,
        // Legacy compatibility value that must never be read as the quantity.
        quantity: '0.333',
        quantityFraction: '250/1000',
      },
    ],
  ],
  [
    optionGroups,
    [
      {
        id: 'group-1',
        name: 'Aroma',
        selection: 'single',
        isRequired: true,
        isVisible: true,
      },
    ],
  ],
  [
    optionValues,
    [
      {
        id: 'value-1',
        name: 'Lavanda',
        extraMaterialCostCop: 1500n,
        extraLaborMinutes: 5,
        suggestedExtraPriceCop: 4000n,
      },
    ],
  ],
  [optionValueComponents, [{ supplyId: lavender, quantityFraction: '1/3' }]],
]);

type Inserted = { table: unknown; values: unknown };

const fakeDatabase = (
  options: { failOn?: unknown; updated?: boolean } = {},
) => {
  const inserted: Inserted[] = [];
  const deleted: unknown[] = [];
  const whereConditions: unknown[] = [];

  const select = vi.fn(() => ({
    from: (table: unknown) => {
      const rows =
        table === products ? [productRow] : (storedRows.get(table) ?? []);
      const result = Object.assign(Promise.resolve(rows), {
        orderBy: () => Promise.resolve(rows),
      });
      return {
        where: (condition: unknown) => {
          whereConditions.push(condition);
          return result;
        },
        orderBy: () => Promise.resolve(rows),
      };
    },
  }));
  const insert = vi.fn((table: unknown) => ({
    values: (values: unknown) => {
      inserted.push({ table, values });
      if (table === options.failOn) {
        const failure = Promise.reject(
          Object.assign(new Error('fk'), { cause: { code: '23503' } }),
        );
        failure.catch(() => undefined);
        return Object.assign(failure, { returning: () => failure });
      }
      const id = table === optionGroups ? 'group-1' : 'value-1';
      const rows = table === products ? [productRow] : [{ id }];
      return Object.assign(Promise.resolve(rows), {
        returning: () => Promise.resolve(rows),
      });
    },
  }));
  const update = vi.fn(() => ({
    set: () => ({
      where: (condition: unknown) => {
        whereConditions.push(condition);
        const rows = options.updated === false ? [] : [productRow];
        return { returning: () => Promise.resolve(rows) };
      },
    }),
  }));
  const remove = vi.fn((table: unknown) => ({
    where: () => {
      deleted.push(table);
      return Promise.resolve();
    },
  }));
  const tx = { select, insert, update, delete: remove };
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback(tx),
  );

  return {
    database: { ...tx, transaction } as never,
    transaction,
    inserted,
    deleted,
    whereConditions,
  };
};

describe('DrizzleProductRepository', () => {
  it('writes product, tree and audit in one transaction with canonical fractions', async () => {
    const mock = fakeDatabase();
    const repository = new DrizzleProductRepository(mock.database);

    const result = await repository.create(
      categoryId,
      candle(),
      audit('product.created'),
    );

    expect(result.ok).toBe(true);
    expect(mock.transaction).toHaveBeenCalledOnce();
    expect(mock.inserted.map(({ table }) => table)).toEqual([
      products,
      productComponents,
      optionGroups,
      optionValues,
      optionValueComponents,
      auditLogs,
    ]);
    expect(mock.inserted[1].values).toEqual([
      {
        productId,
        supplyId: wax,
        componentProductId: null,
        quantity: null,
        quantityFraction: '1/4',
        position: 0,
      },
    ]);
    expect(mock.inserted[4].values).toEqual([
      {
        optionValueId: 'value-1',
        supplyId: lavender,
        quantityFraction: '1/3',
        position: 0,
      },
    ]);
    expect(mock.inserted[5].values).toMatchObject({
      eventType: 'product.created',
      metadata: { method: 'admin_product_form' },
    });
  });

  it('maps a foreign-key failure inside the tree and never writes the audit row', async () => {
    const mock = fakeDatabase({ failOn: productComponents });
    const repository = new DrizzleProductRepository(mock.database);

    await expect(
      repository.create(categoryId, candle(), audit('product.created')),
    ).resolves.toEqual({ ok: false, reason: 'reference_not_found' });
    expect(mock.inserted.map(({ table }) => table)).not.toContain(auditLogs);
  });

  it('maps a unique violation to name_taken', async () => {
    const mock = fakeDatabase({ failOn: products });
    const unique = Object.assign(new Error('dup'), { code: '23505' });
    const repository = new DrizzleProductRepository({
      ...(mock.database as object),
      transaction: () => Promise.reject(unique),
    } as never);

    await expect(
      repository.create(categoryId, candle(), audit('product.created')),
    ).resolves.toEqual({ ok: false, reason: 'name_taken' });
  });

  it('replaces the component tree of an active product only on update', async () => {
    const mock = fakeDatabase();
    const repository = new DrizzleProductRepository(mock.database);

    await repository.update(
      productId,
      categoryId,
      candle(),
      audit('product.updated'),
    );

    expect(sql(mock.whereConditions[0])).toContain(
      '"products"."deleted_at" is null',
    );
    expect(mock.deleted).toEqual([productComponents, optionGroups]);
    expect(mock.inserted.at(-1)?.table).toBe(auditLogs);
  });

  it('does not audit an update or archive of a missing product', async () => {
    const mock = fakeDatabase({ updated: false });
    const repository = new DrizzleProductRepository(mock.database);

    await expect(
      repository.update(
        productId,
        categoryId,
        candle(),
        audit('product.updated'),
      ),
    ).resolves.toEqual({ ok: false, reason: 'not_found' });
    await expect(
      repository.archive(productId, audit('product.archived')),
    ).resolves.toBe(false);
    expect(mock.inserted).toEqual([]);
  });

  it('reads quantities from quantity_fraction only and normalizes them', async () => {
    const mock = fakeDatabase();
    const repository = new DrizzleProductRepository(mock.database);

    const product = await repository.findActive(productId);

    expect(sql(mock.whereConditions[0])).toContain(
      '"products"."deleted_at" is null',
    );
    expect(product?.components[0].quantity.toString()).toBe('1/4');
    expect(
      product?.optionGroups[0].values[0].components[0].quantity.toString(),
    ).toBe('1/3');
    expect(product?.optionGroups[0].values[0].suggestedExtraPriceCop).toBe(
      4000,
    );
  });

  it('lists only active, non-bundle products as bundle candidates', async () => {
    const mock = fakeDatabase();
    const repository = new DrizzleProductRepository(mock.database);

    await repository.listBundleProducts();

    const condition = sql(mock.whereConditions[0]);
    expect(condition).toContain('"products"."deleted_at" is null');
    expect(condition).toContain('"products"."calculation_type" <> $1');
  });
});
