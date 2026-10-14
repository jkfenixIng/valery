import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../../auth/domain/audit-event';
import {
  Product,
  type ProductDetails,
  type ProductInput,
} from '../domain/product';
import type {
  ProductRecord,
  ProductRepository,
  ProductWriteResult,
} from './product-repository';
import {
  archiveProduct,
  createProduct,
  getActiveProduct,
  listActiveProducts,
  updateProduct,
} from './products';

type Stored = ProductRecord & { archived: boolean };

class InMemoryProductRepository implements ProductRepository {
  readonly audits: AuditEvent[] = [];
  readonly rows: Stored[] = [];

  constructor(
    readonly categoryId: string,
    readonly supplyIds: string[],
  ) {}

  async listActive() {
    return this.rows
      .filter((row) => !row.archived)
      .map(({ id, categoryId, name, calculationType, isPublished }) => ({
        id,
        categoryId,
        name,
        calculationType,
        isPublished,
        needsReview: false,
      }));
  }

  async findActive(id: string) {
    const row = this.active(id);
    return row
      ? {
          id: row.id,
          categoryId: row.categoryId,
          input: Product.toInput(row),
          validationIssues: [],
        }
      : null;
  }

  async listCategories() {
    return [{ id: this.categoryId, name: 'Postres' }];
  }

  async listActiveSupplies() {
    return this.supplyIds.map((id) => ({ id, name: id, unit: 'g' }));
  }

  async listBundleProducts() {
    return this.rows
      .filter((row) => !row.archived && row.calculationType !== 'bundle')
      .map(({ id, name }) => ({ id, name }));
  }

  async create(
    categoryId: string,
    product: ProductDetails,
    audit: AuditEvent,
  ): Promise<ProductWriteResult> {
    if (categoryId !== this.categoryId) {
      return { ok: false, reason: 'category_not_found' };
    }
    if (this.rows.some((row) => row.name === product.name)) {
      return { ok: false, reason: 'name_taken' };
    }
    const row = { id: randomUUID(), categoryId, ...product, archived: false };
    this.rows.push(row);
    this.audits.push(audit);
    return { ok: true, product: row };
  }

  async update(
    id: string,
    categoryId: string,
    product: ProductDetails,
    audit: AuditEvent,
  ): Promise<ProductWriteResult> {
    const row = this.active(id);
    if (!row) return { ok: false, reason: 'not_found' };
    if (product.calculationType === 'bundle' && this.isComponent(id)) {
      return { ok: false, reason: 'used_as_bundle_component' };
    }
    Object.assign(row, product, { categoryId });
    this.audits.push(audit);
    return { ok: true, product: row };
  }

  async archive(id: string, audit: AuditEvent) {
    const row = this.active(id);
    if (!row) return 'not_found' as const;
    if (this.isComponent(id)) return 'in_use_by_bundle' as const;
    row.archived = true;
    this.audits.push(audit);
    return 'archived' as const;
  }

  private active(id: string) {
    return this.rows.find((row) => row.id === id && !row.archived);
  }

  private isComponent(id: string) {
    return this.rows.some(
      (row) =>
        !row.archived &&
        row.components.some(
          (component) =>
            component.kind === 'product' && component.referenceId === id,
        ),
    );
  }
}

const categoryId = randomUUID();
const flour = randomUUID();
const bag = randomUUID();
const actorUserId = 'admin-1';

const recipe: ProductInput = {
  name: 'Torta',
  description: 'Torta de chocolate.',
  calculationType: 'recipe',
  baseLaborMinutes: 60,
  ownMarginBps: null,
  recipeYieldPortions: 10,
  fixedPriceCop: null,
  isPublished: false,
  components: [{ kind: 'supply', referenceId: flour, quantity: '1/3' }],
  optionGroups: [],
};

const setup = () => new InMemoryProductRepository(categoryId, [flour, bag]);

const created = async (
  repository: InMemoryProductRepository,
  input: ProductInput = recipe,
) => {
  const result = await createProduct(repository, {
    actorUserId,
    categoryId,
    input,
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
};

describe('product use cases', () => {
  it('creates, edits and archives a product with one data-free audit each', async () => {
    const repository = setup();
    const product = await created(repository);
    expect(product.components[0].quantity.toString()).toBe('1/3');

    const updated = await updateProduct(repository, {
      actorUserId,
      productId: product.id,
      categoryId,
      input: { ...recipe, recipeYieldPortions: 8 },
    });
    expect(updated.ok && updated.value.recipeYieldPortions).toBe(8);

    await expect(
      archiveProduct(repository, { actorUserId, productId: product.id }),
    ).resolves.toEqual({ ok: true, value: undefined });
    await expect(listActiveProducts(repository)).resolves.toEqual([]);
    await expect(getActiveProduct(repository, product.id)).resolves.toBeNull();
    expect(repository.audits.map((audit) => audit.toRecord())).toEqual(
      ['product.created', 'product.updated', 'product.archived'].map(
        (eventType) => ({
          eventType,
          outcome: 'success',
          actorUserId,
          subjectHash: null,
          metadata: { method: 'admin_product_form' },
        }),
      ),
    );
  });

  it.each([null, '', '  '])(
    'rejects actor %p for every mutation without writing',
    async (actor) => {
      const repository = setup();
      const productId = (await created(repository)).id;
      const unauthorized = { ok: false, error: { code: 'UNAUTHORIZED' } };

      await expect(
        createProduct(repository, {
          actorUserId: actor,
          categoryId,
          input: recipe,
        }),
      ).resolves.toEqual(unauthorized);
      await expect(
        updateProduct(repository, {
          actorUserId: actor,
          productId,
          categoryId,
          input: recipe,
        }),
      ).resolves.toEqual(unauthorized);
      await expect(
        archiveProduct(repository, { actorUserId: actor, productId }),
      ).resolves.toEqual(unauthorized);
      expect(repository.audits).toHaveLength(1);
    },
  );

  it('rejects references to inactive supplies and ineligible bundle products', async () => {
    const repository = setup();
    const cake = await created(repository);
    const giftBag = await created(repository, {
      ...recipe,
      name: 'Bolsa',
      calculationType: 'bundle',
      recipeYieldPortions: null,
      components: [
        { kind: 'supply', referenceId: bag, quantity: '1' },
        { kind: 'product', referenceId: cake.id, quantity: '1/2' },
      ],
    });

    const result = await createProduct(repository, {
      actorUserId,
      categoryId,
      input: {
        ...recipe,
        name: 'Combo de combos',
        calculationType: 'bundle',
        recipeYieldPortions: null,
        components: [
          { kind: 'supply', referenceId: randomUUID(), quantity: '1' },
          { kind: 'product', referenceId: giftBag.id, quantity: '1' },
        ],
      },
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PRODUCT_INVALID',
        fields: ['components.0.referenceId', 'components.1.referenceId'],
      },
    });
    expect(repository.audits).toHaveLength(2);
  });

  it('rejects a bundle that includes itself', async () => {
    const repository = setup();
    const cake = await created(repository);

    const result = await updateProduct(repository, {
      actorUserId,
      productId: cake.id,
      categoryId,
      input: {
        ...recipe,
        calculationType: 'bundle',
        recipeYieldPortions: null,
        components: [{ kind: 'product', referenceId: cake.id, quantity: '1' }],
      },
    });

    expect(result.ok).toBe(false);
  });

  it('protects bundle components from archiving and from becoming bundles', async () => {
    const repository = setup();
    const cake = await created(repository);
    await created(repository, {
      ...recipe,
      name: 'Combo',
      calculationType: 'bundle',
      recipeYieldPortions: null,
      components: [{ kind: 'product', referenceId: cake.id, quantity: '1' }],
    });

    await expect(
      archiveProduct(repository, { actorUserId, productId: cake.id }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRODUCT_IN_USE_BY_BUNDLE' },
    });
    await expect(
      updateProduct(repository, {
        actorUserId,
        productId: cake.id,
        categoryId,
        input: {
          ...recipe,
          calculationType: 'bundle',
          recipeYieldPortions: null,
          components: [{ kind: 'supply', referenceId: bag, quantity: '1' }],
        },
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRODUCT_USED_AS_BUNDLE_COMPONENT' },
    });
    expect(repository.audits).toHaveLength(2);
  });

  it('maps ineligible components found by the store to field errors', async () => {
    const repository = setup();
    const cake = await created(repository);
    repository.create = async () => ({
      ok: false,
      reason: 'component_ineligible',
      fields: ['components.0.referenceId'],
    });

    await expect(
      createProduct(repository, {
        actorUserId,
        categoryId,
        input: {
          ...recipe,
          name: 'Combo',
          calculationType: 'bundle',
          recipeYieldPortions: null,
          components: [
            { kind: 'product', referenceId: cake.id, quantity: '1' },
          ],
        },
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRODUCT_INVALID', fields: ['components.0.referenceId'] },
    });
  });

  it('maps store failures and unknown ids without auditing', async () => {
    const repository = setup();
    await created(repository);

    await expect(
      createProduct(repository, { actorUserId, categoryId, input: recipe }),
    ).resolves.toEqual({ ok: false, error: { code: 'PRODUCT_NAME_TAKEN' } });
    await expect(
      createProduct(repository, {
        actorUserId,
        categoryId: randomUUID(),
        input: { ...recipe, name: 'Otra' },
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRODUCT_CATEGORY_NOT_FOUND' },
    });
    await expect(
      archiveProduct(repository, { actorUserId, productId: 'not-a-uuid' }),
    ).resolves.toEqual({ ok: false, error: { code: 'PRODUCT_NOT_FOUND' } });
    expect(repository.audits).toHaveLength(1);
  });
});
