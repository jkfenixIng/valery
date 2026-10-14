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

const otherProduct = '77777777-7777-4777-8777-777777777777';

/** Bundle with the wax supply and, optionally, one component product. */
const bundle = (componentProductId?: string) => {
  const result = Product.create({
    ...candleInput,
    calculationType: 'bundle',
    optionGroups: [],
    components: [
      { kind: 'supply', referenceId: wax, quantity: '1' },
      ...(componentProductId
        ? [
            {
              kind: 'product' as const,
              referenceId: componentProductId,
              quantity: '1',
            },
          ]
        : []),
    ],
  });
  if (!result.ok) throw new Error('Invalid fixture.');
  return result.value;
};

const productRow: typeof products.$inferSelect = {
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
        productId,
        supplyId: wax,
        componentProductId: null,
        // Legacy compatibility value that must never be read as the quantity.
        quantity: '0.333',
        quantityFraction: '250/1000',
        position: 0,
      },
    ],
  ],
  [
    optionGroups,
    [
      {
        id: 'group-1',
        productId,
        name: 'Aroma',
        selection: 'single',
        isRequired: true,
        isVisible: true,
        position: 0,
      },
    ],
  ],
  [
    optionValues,
    [
      {
        id: 'value-1',
        optionGroupId: 'group-1',
        name: 'Lavanda',
        extraMaterialCostCop: 1500n,
        extraLaborMinutes: 5,
        suggestedExtraPriceCop: 4000n,
        position: 0,
      },
    ],
  ],
  [
    optionValueComponents,
    [
      {
        optionValueId: 'value-1',
        supplyId: lavender,
        quantityFraction: '1/3',
        position: 0,
      },
    ],
  ],
]);

type Inserted = { table: unknown; values: unknown };

const fakeDatabase = (
  options: {
    failOn?: unknown;
    updated?: boolean;
    componentUsage?: boolean;
    productRow?: typeof productRow;
    /** Product rows returned by the `FOR UPDATE` integrity read. */
    lockedRows?: { id: string; calculationType: string }[];
  } = {},
) => {
  const inserted: Inserted[] = [];
  const deleted: unknown[] = [];
  const whereConditions: unknown[] = [];
  const locks: {
    strength: string;
    insideTransaction: boolean;
    condition: unknown;
  }[] = [];
  const usageChecks: { insideTransaction: boolean }[] = [];
  let insideTransaction = false;

  const select = vi.fn((fields?: unknown) => ({
    from: (table: unknown) => {
      const rows =
        table === products
          ? options.updated === false
            ? []
            : [options.productRow ?? productRow]
          : table === productComponents && fields
            ? options.componentUsage
              ? [{ id: 'usage-1' }]
              : []
            : (storedRows.get(table) ?? []);
      const result = Object.assign(Promise.resolve(rows), {
        orderBy: () => result,
        for: (strength: string) => {
          locks.push({ strength, insideTransaction, condition: lastWhere });
          return Promise.resolve(options.lockedRows ?? rows);
        },
        limit: () => {
          usageChecks.push({ insideTransaction });
          return Promise.resolve(rows);
        },
      });
      let lastWhere: unknown;
      const query = {
        where: (condition: unknown) => {
          whereConditions.push(condition);
          lastWhere = condition;
          return result;
        },
        innerJoin: () => query,
        orderBy: () => result,
      };
      return query;
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
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => {
    insideTransaction = true;
    try {
      return await callback(tx);
    } finally {
      insideTransaction = false;
    }
  });

  return {
    database: { ...tx, transaction } as never,
    transaction,
    inserted,
    deleted,
    locks,
    usageChecks,
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

  it('maps component and category foreign keys without writing the audit row', async () => {
    const component = fakeDatabase({ failOn: productComponents });
    const componentRepository = new DrizzleProductRepository(
      component.database,
    );
    await expect(
      componentRepository.create(
        categoryId,
        candle(),
        audit('product.created'),
      ),
    ).resolves.toEqual({ ok: false, reason: 'reference_not_found' });
    expect(component.inserted.map(({ table }) => table)).not.toContain(
      auditLogs,
    );

    const category = fakeDatabase();
    const foreignKey = Object.assign(new Error('fk'), {
      code: '23503',
      constraint: 'products_category_id_categories_id_fk',
    });
    const categoryRepository = new DrizzleProductRepository({
      ...(category.database as object),
      transaction: () => Promise.reject(foreignKey),
    } as never);
    await expect(
      categoryRepository.create(categoryId, candle(), audit('product.created')),
    ).resolves.toEqual({ ok: false, reason: 'category_not_found' });
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
    ).resolves.toBe('not_found');
    expect(mock.inserted).toEqual([]);
  });

  it('reads quantities from quantity_fraction only and normalizes them', async () => {
    const mock = fakeDatabase();
    const repository = new DrizzleProductRepository(mock.database);

    const product = await repository.findActive(productId);

    expect(sql(mock.whereConditions[0])).toContain(
      '"products"."deleted_at" is null',
    );
    expect(product?.input.components[0].quantity).toBe('1/4');
    expect(
      product?.input.optionGroups[0].values[0].components[0].quantity,
    ).toBe('1/3');
    expect(
      product?.input.optionGroups[0].values[0].suggestedExtraPriceCop,
    ).toBe(4000);
  });

  it('returns invalid legacy fixed-price rows for review without changing them', async () => {
    const mock = fakeDatabase({
      productRow: {
        ...productRow,
        calculationType: 'fixed_price',
        salePriceCop: 0n,
        marginBps: 10_000,
      },
    });
    const repository = new DrizzleProductRepository(mock.database);

    const product = await repository.findActive(productId);

    expect(product).toMatchObject({
      id: productId,
      validationIssues: [
        'ownMarginBps',
        'fixedPriceCop',
        'components',
        'optionGroups',
      ],
      input: {
        calculationType: 'fixed_price',
        fixedPriceCop: 0,
        ownMarginBps: 10_000,
        components: [
          { kind: 'supply', referenceId: wax, quantity: '250/1000' },
        ],
      },
    });
  });

  it('flags rows that need review in the active list', async () => {
    const legacy = fakeDatabase({
      productRow: { ...productRow, calculationType: 'fixed_price' },
    });
    await expect(
      new DrizzleProductRepository(legacy.database).listActive(),
    ).resolves.toMatchObject([{ id: productId, needsReview: true }]);

    const valid = fakeDatabase();
    await expect(
      new DrizzleProductRepository(valid.database).listActive(),
    ).resolves.toMatchObject([{ id: productId, needsReview: false }]);
  });

  it('locks target and component rows inside the transaction before a bundle write', async () => {
    const mock = fakeDatabase({
      lockedRows: [
        { id: productId, calculationType: 'base_with_extras' },
        { id: otherProduct, calculationType: 'recipe' },
      ],
    });
    const repository = new DrizzleProductRepository(mock.database);

    await repository.update(
      productId,
      categoryId,
      bundle(otherProduct),
      audit('product.updated'),
    );

    expect(mock.locks).toHaveLength(1);
    expect(mock.locks[0]).toMatchObject({
      strength: 'update',
      insideTransaction: true,
    });
    const locked = dialect.sqlToQuery(mock.locks[0].condition as never);
    expect(locked.sql).toContain('"products"."id" in');
    expect(locked.params).toEqual(
      expect.arrayContaining([productId, otherProduct]),
    );
    expect(mock.usageChecks).toEqual([{ insideTransaction: true }]);
    expect(mock.inserted.at(-1)?.table).toBe(auditLogs);
  });

  it('rejects ineligible component products found under the lock', async () => {
    const mock = fakeDatabase({
      lockedRows: [
        { id: productId, calculationType: 'base_with_extras' },
        { id: otherProduct, calculationType: 'bundle' },
      ],
    });
    const repository = new DrizzleProductRepository(mock.database);

    await expect(
      repository.create(
        categoryId,
        bundle(otherProduct),
        audit('product.created'),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: 'component_ineligible',
      fields: ['components.1.referenceId'],
    });
    await expect(
      repository.update(
        productId,
        categoryId,
        bundle(productId),
        audit('product.updated'),
      ),
    ).resolves.toEqual({
      ok: false,
      reason: 'component_ineligible',
      fields: ['components.1.referenceId'],
    });
    expect(mock.inserted).toEqual([]);
  });

  it('rejects turning a product used as a bundle component into a bundle', async () => {
    const mock = fakeDatabase({ componentUsage: true });
    const repository = new DrizzleProductRepository(mock.database);

    await expect(
      repository.update(
        productId,
        categoryId,
        bundle(),
        audit('product.updated'),
      ),
    ).resolves.toEqual({ ok: false, reason: 'used_as_bundle_component' });
    expect(mock.usageChecks).toEqual([{ insideTransaction: true }]);
    expect(mock.inserted).toEqual([]);
  });

  it('rejects archiving a product used by an active bundle under a row lock', async () => {
    const mock = fakeDatabase({ componentUsage: true });
    const repository = new DrizzleProductRepository(mock.database);

    await expect(
      repository.archive(productId, audit('product.archived')),
    ).resolves.toBe('in_use_by_bundle');
    expect(mock.locks).toMatchObject([
      { strength: 'update', insideTransaction: true },
    ]);
    expect(mock.usageChecks).toEqual([{ insideTransaction: true }]);
    expect(mock.inserted).toEqual([]);
  });

  it('archives an unused product with its audit row', async () => {
    const mock = fakeDatabase();
    const repository = new DrizzleProductRepository(mock.database);

    await expect(
      repository.archive(productId, audit('product.archived')),
    ).resolves.toBe('archived');
    expect(mock.inserted.map(({ table }) => table)).toEqual([auditLogs]);
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
