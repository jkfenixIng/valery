import { and, asc, eq, inArray, isNull, ne } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  auditLogs,
  categories,
  optionGroups,
  optionValueComponents,
  optionValues,
  productComponents,
  products,
  supplies,
} from '@/shared/infrastructure/db/schema';

import type { AuditEvent } from '../../auth/domain/audit-event';
import {
  Product,
  type CalculationType,
  type ProductDetails,
  type ProductInput,
} from '../domain/product';
import type {
  BundleProductOption,
  ProductArchiveResult,
  ProductCategory,
  ProductRepository,
  ProductSummary,
  ProductSupplyOption,
  ProductWriteResult,
  StoredProduct,
} from '../application/product-repository';

const uniqueViolation = '23505';
const foreignKeyViolation = '23503';
/** The only foreign key on `products` that a product write can violate. */
const categoryForeignKey = 'products_category_id_categories_id_fk';

/** Reads a Postgres error field, also when wrapped in a driver `cause`. */
const postgresField = (
  error: unknown,
  field: 'code' | 'constraint',
): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if (field in error) {
    const value = (error as Record<string, unknown>)[field];
    if (typeof value === 'string') return value;
  }
  return 'cause' in error ? postgresField(error.cause, field) : undefined;
};

const mapConstraintViolation = async (
  write: () => Promise<ProductWriteResult>,
): Promise<ProductWriteResult> => {
  try {
    return await write();
  } catch (error) {
    const code = postgresField(error, 'code');
    if (code === uniqueViolation) return { ok: false, reason: 'name_taken' };
    if (code === foreignKeyViolation) {
      return postgresField(error, 'constraint') === categoryForeignKey
        ? { ok: false, reason: 'category_not_found' }
        : { ok: false, reason: 'reference_not_found' };
    }
    throw error;
  }
};

const auditValues = (audit: AuditEvent) => {
  const event = audit.toRecord();
  return {
    actorUserId: event.actorUserId,
    eventType: event.eventType,
    metadata: event.metadata,
    outcome: event.outcome,
    subjectHash: event.subjectHash,
  };
};

const active = (id: string) =>
  and(eq(products.id, id), isNull(products.deletedAt));

const columns = (details: ProductDetails) => ({
  baseLaborMinutes: details.baseLaborMinutes,
  calculationType: details.calculationType,
  description: details.description,
  isPublished: details.isPublished,
  marginBps: details.ownMarginBps,
  name: details.name,
  recipeYieldPortions: details.recipeYieldPortions,
  salePriceCop:
    details.fixedPriceCop === null ? null : BigInt(details.fixedPriceCop),
});

type ProductRow = typeof products.$inferSelect;

const groupBy = <T, K>(rows: readonly T[], key: (row: T) => K) => {
  const groups = new Map<K, T[]>();
  for (const row of rows)
    groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
};

const byPosition = (a: { position: number }, b: { position: number }) =>
  a.position - b.position;

/**
 * Loads the component and option trees of many products in four queries.
 * Exact fractions come exclusively from `quantity_fraction`; legacy numeric
 * `quantity` is compatibility-only and is intentionally never parsed here.
 */
const loadInputs = async (
  database: NodePgDatabase,
  rows: readonly ProductRow[],
): Promise<Map<string, ProductInput>> => {
  const productIds = rows.map((row) => row.id);
  if (productIds.length === 0) return new Map();

  const [componentRows, groupRows] = await Promise.all([
    database
      .select()
      .from(productComponents)
      .where(inArray(productComponents.productId, productIds)),
    database
      .select()
      .from(optionGroups)
      .where(inArray(optionGroups.productId, productIds)),
  ]);
  const groupIds = groupRows.map((group) => group.id);
  const valueRows =
    groupIds.length === 0
      ? []
      : await database
          .select()
          .from(optionValues)
          .where(inArray(optionValues.optionGroupId, groupIds));
  const valueIds = valueRows.map((value) => value.id);
  const valueComponentRows =
    valueIds.length === 0
      ? []
      : await database
          .select()
          .from(optionValueComponents)
          .where(inArray(optionValueComponents.optionValueId, valueIds));

  const componentsOf = groupBy(componentRows, (row) => row.productId);
  const groupsOf = groupBy(groupRows, (row) => row.productId);
  const valuesOf = groupBy(valueRows, (row) => row.optionGroupId);
  const valueComponentsOf = groupBy(
    valueComponentRows,
    (row) => row.optionValueId,
  );

  return new Map(
    rows.map((row) => [
      row.id,
      {
        name: row.name,
        description: row.description,
        // Re-validated by Product.create; an unknown value becomes an issue.
        calculationType: row.calculationType as CalculationType,
        baseLaborMinutes: row.baseLaborMinutes,
        ownMarginBps: row.marginBps,
        recipeYieldPortions: row.recipeYieldPortions,
        fixedPriceCop:
          row.salePriceCop === null ? null : Number(row.salePriceCop),
        isPublished: row.isPublished,
        components: [...(componentsOf.get(row.id) ?? [])]
          .sort(byPosition)
          .map((component) => ({
            kind: component.supplyId === null ? 'product' : 'supply',
            referenceId:
              component.supplyId ?? component.componentProductId ?? '',
            quantity: component.quantityFraction,
          })),
        optionGroups: [...(groupsOf.get(row.id) ?? [])]
          .sort(byPosition)
          .map((group) => ({
            name: group.name,
            selection: group.selection as 'single' | 'multiple',
            required: group.isRequired,
            visible: group.isVisible,
            values: [...(valuesOf.get(group.id) ?? [])]
              .sort(byPosition)
              .map((value) => ({
                name: value.name,
                extraMaterialCostCop: Number(value.extraMaterialCostCop),
                extraLaborMinutes: value.extraLaborMinutes,
                suggestedExtraPriceCop:
                  value.suggestedExtraPriceCop === null
                    ? null
                    : Number(value.suggestedExtraPriceCop),
                components: [...(valueComponentsOf.get(value.id) ?? [])]
                  .sort(byPosition)
                  .map((component) => ({
                    supplyId: component.supplyId,
                    quantity: component.quantityFraction,
                  })),
              })),
          })),
      },
    ]),
  );
};

/**
 * Valid rows come back in canonical form. Rows that violate the current
 * rules come back untouched with their issues: reads never change data.
 */
const toStored = (row: ProductRow, input: ProductInput): StoredProduct => {
  const product = Product.create(input);
  return product.ok
    ? {
        id: row.id,
        categoryId: row.categoryId,
        input: Product.toInput(product.value),
        validationIssues: [],
      }
    : {
        id: row.id,
        categoryId: row.categoryId,
        input,
        validationIssues: product.error.fields,
      };
};

const loadStored = async (
  database: NodePgDatabase,
  rows: readonly ProductRow[],
): Promise<StoredProduct[]> => {
  const inputs = await loadInputs(database, rows);
  return rows.flatMap((row) => {
    const input = inputs.get(row.id);
    return input ? [toStored(row, input)] : [];
  });
};

/** Active products that use `productId` as a bundle component. */
const isUsedAsComponent = async (
  transaction: NodePgDatabase,
  productId: string,
): Promise<boolean> => {
  const usages = await transaction
    .select({ id: productComponents.id })
    .from(productComponents)
    .innerJoin(products, eq(productComponents.productId, products.id))
    .where(
      and(
        eq(productComponents.componentProductId, productId),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  return usages.length > 0;
};

type BundleCheck =
  Readonly<{ ok: true }> | Exclude<ProductWriteResult, Readonly<{ ok: true }>>;

/**
 * Authoritative bundle integrity check. Locks (`FOR UPDATE`, in id order to
 * avoid deadlocks) the target product and every component product before
 * reading them, so concurrent writes that could nest bundles or archive a
 * used component serialize on the same rows and see each other's result.
 */
const checkBundleIntegrity = async (
  transaction: NodePgDatabase,
  details: ProductDetails,
  targetId?: string,
): Promise<BundleCheck> => {
  const target = targetId?.toLowerCase();
  const componentIds = details.components
    .filter((component) => component.kind === 'product')
    .map((component) => component.referenceId.toLowerCase());
  const ids = [...new Set([...(target ? [target] : []), ...componentIds])];
  if (ids.length === 0) return { ok: true };

  const locked = await transaction
    .select({ id: products.id, calculationType: products.calculationType })
    .from(products)
    .where(and(inArray(products.id, ids), isNull(products.deletedAt)))
    .orderBy(asc(products.id))
    .for('update');
  const types = new Map(
    locked.map((row) => [row.id.toLowerCase(), row.calculationType]),
  );
  if (target && !types.has(target)) return { ok: false, reason: 'not_found' };

  const fields = details.components.flatMap((component, index) => {
    if (component.kind !== 'product') return [];
    const id = component.referenceId.toLowerCase();
    const type = types.get(id);
    return id !== target && type !== undefined && type !== 'bundle'
      ? []
      : [`components.${index}.referenceId`];
  });
  if (fields.length > 0) {
    return { ok: false, reason: 'component_ineligible', fields };
  }

  if (
    target &&
    details.calculationType === 'bundle' &&
    (await isUsedAsComponent(transaction, target))
  ) {
    return { ok: false, reason: 'used_as_bundle_component' };
  }
  return { ok: true };
};

const writeTree = async (
  transaction: NodePgDatabase,
  productId: string,
  details: ProductDetails,
) => {
  await transaction
    .delete(productComponents)
    .where(eq(productComponents.productId, productId));
  await transaction
    .delete(optionGroups)
    .where(eq(optionGroups.productId, productId));

  if (details.components.length > 0) {
    await transaction.insert(productComponents).values(
      details.components.map((component, position) => ({
        productId,
        supplyId: component.kind === 'supply' ? component.referenceId : null,
        componentProductId:
          component.kind === 'product' ? component.referenceId : null,
        quantity: null,
        quantityFraction: component.quantity.toString(),
        position,
      })),
    );
  }
  for (const [groupPosition, group] of details.optionGroups.entries()) {
    const [groupRow] = await transaction
      .insert(optionGroups)
      .values({
        productId,
        name: group.name,
        selection: group.selection,
        isRequired: group.required,
        isVisible: group.visible,
        position: groupPosition,
      })
      .returning({ id: optionGroups.id });
    for (const [valuePosition, value] of group.values.entries()) {
      const [valueRow] = await transaction
        .insert(optionValues)
        .values({
          optionGroupId: groupRow.id,
          name: value.name,
          extraMaterialCostCop: BigInt(value.extraMaterialCostCop),
          extraLaborMinutes: value.extraLaborMinutes,
          suggestedExtraPriceCop:
            value.suggestedExtraPriceCop === null
              ? null
              : BigInt(value.suggestedExtraPriceCop),
          position: valuePosition,
        })
        .returning({ id: optionValues.id });
      if (value.components.length > 0) {
        await transaction.insert(optionValueComponents).values(
          value.components.map((component, position) => ({
            optionValueId: valueRow.id,
            supplyId: component.supplyId,
            quantityFraction: component.quantity.toString(),
            position,
          })),
        );
      }
    }
  }
};

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async listActive(): Promise<readonly ProductSummary[]> {
    const rows = await this.database
      .select()
      .from(products)
      .where(isNull(products.deletedAt))
      .orderBy(asc(products.name));
    const stored = new Map(
      (await loadStored(this.database, rows)).map((product) => [
        product.id,
        product,
      ]),
    );
    return rows.map((row) => ({
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      calculationType: row.calculationType as CalculationType,
      isPublished: row.isPublished,
      needsReview: (stored.get(row.id)?.validationIssues.length ?? 0) > 0,
    }));
  }

  async findActive(id: string): Promise<StoredProduct | null> {
    const rows = await this.database.select().from(products).where(active(id));
    const [product] = await loadStored(this.database, rows);
    return product ?? null;
  }

  async listCategories(): Promise<readonly ProductCategory[]> {
    return this.database
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name));
  }

  async listActiveSupplies(): Promise<readonly ProductSupplyOption[]> {
    return this.database
      .select({ id: supplies.id, name: supplies.name, unit: supplies.unit })
      .from(supplies)
      .where(isNull(supplies.deletedAt))
      .orderBy(asc(supplies.name));
  }

  async listBundleProducts(): Promise<readonly BundleProductOption[]> {
    return this.database
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(
        and(isNull(products.deletedAt), ne(products.calculationType, 'bundle')),
      )
      .orderBy(asc(products.name));
  }

  create(
    categoryId: string,
    product: ProductDetails,
    audit: AuditEvent,
  ): Promise<ProductWriteResult> {
    return mapConstraintViolation(() =>
      this.database.transaction(async (transaction) => {
        const integrity = await checkBundleIntegrity(transaction, product);
        if (!integrity.ok) return integrity;
        const [row] = await transaction
          .insert(products)
          .values({ ...columns(product), categoryId })
          .returning({ id: products.id });
        await writeTree(transaction, row.id, product);
        await transaction.insert(auditLogs).values(auditValues(audit));
        return { ok: true, product: { id: row.id, categoryId, ...product } };
      }),
    );
  }

  update(
    id: string,
    categoryId: string,
    product: ProductDetails,
    audit: AuditEvent,
  ): Promise<ProductWriteResult> {
    return mapConstraintViolation(() =>
      this.database.transaction(async (transaction) => {
        const integrity = await checkBundleIntegrity(transaction, product, id);
        if (!integrity.ok) return integrity;
        const [row] = await transaction
          .update(products)
          .set({ ...columns(product), categoryId, updatedAt: new Date() })
          .where(active(id))
          .returning({ id: products.id });
        if (!row) return { ok: false, reason: 'not_found' };
        await writeTree(transaction, row.id, product);
        await transaction.insert(auditLogs).values(auditValues(audit));
        return { ok: true, product: { id: row.id, categoryId, ...product } };
      }),
    );
  }

  async archive(id: string, audit: AuditEvent): Promise<ProductArchiveResult> {
    return this.database.transaction(async (transaction) => {
      // Locked so no bundle can start using it until this archive commits.
      const [target] = await transaction
        .select({ id: products.id })
        .from(products)
        .where(active(id))
        .for('update');
      if (!target) return 'not_found';
      if (await isUsedAsComponent(transaction, target.id)) {
        return 'in_use_by_bundle';
      }

      const now = new Date();
      const [row] = await transaction
        .update(products)
        .set({ deletedAt: now, updatedAt: now })
        .where(active(id))
        .returning({ id: products.id });
      if (!row) return 'not_found';
      await transaction.insert(auditLogs).values(auditValues(audit));
      return 'archived';
    });
  }
}
