import { and, asc, eq, isNull, ne } from 'drizzle-orm';
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
  ProductCategory,
  ProductRecord,
  ProductRepository,
  ProductSummary,
  ProductSupplyOption,
  ProductWriteResult,
} from '../application/product-repository';

const uniqueViolation = '23505';
const foreignKeyViolation = '23503';

const postgresCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? postgresCode(error.cause) : undefined;
};

const mapConstraintViolation = async (
  write: () => Promise<ProductWriteResult>,
): Promise<ProductWriteResult> => {
  try {
    return await write();
  } catch (error) {
    const code = postgresCode(error);
    if (code === uniqueViolation) return { ok: false, reason: 'name_taken' };
    if (code === foreignKeyViolation) {
      return { ok: false, reason: 'reference_not_found' };
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

/**
 * Reads exact fractions exclusively from `quantity_fraction`; legacy numeric
 * `quantity` is compatibility-only and is intentionally never parsed here.
 */
const asRecord = async (
  database: NodePgDatabase,
  row: typeof products.$inferSelect,
): Promise<ProductRecord> => {
  const [componentRows, groupRows] = await Promise.all([
    database
      .select()
      .from(productComponents)
      .where(eq(productComponents.productId, row.id))
      .orderBy(asc(productComponents.position)),
    database
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.productId, row.id))
      .orderBy(asc(optionGroups.position)),
  ]);
  const groups = await Promise.all(
    groupRows.map(async (group) => {
      const values = await database
        .select()
        .from(optionValues)
        .where(eq(optionValues.optionGroupId, group.id))
        .orderBy(asc(optionValues.position));
      return {
        name: group.name,
        selection: group.selection as 'single' | 'multiple',
        required: group.isRequired,
        visible: group.isVisible,
        values: await Promise.all(
          values.map(async (value) => {
            const components = await database
              .select()
              .from(optionValueComponents)
              .where(eq(optionValueComponents.optionValueId, value.id))
              .orderBy(asc(optionValueComponents.position));
            return {
              name: value.name,
              extraMaterialCostCop: Number(value.extraMaterialCostCop),
              extraLaborMinutes: value.extraLaborMinutes,
              suggestedExtraPriceCop:
                value.suggestedExtraPriceCop === null
                  ? null
                  : Number(value.suggestedExtraPriceCop),
              components: components.map((component) => ({
                supplyId: component.supplyId,
                quantity: component.quantityFraction,
              })),
            };
          }),
        ),
      };
    }),
  );
  const input: ProductInput = {
    name: row.name,
    description: row.description,
    // Re-validated by Product.create, so an unexpected value fails loudly.
    calculationType: row.calculationType as CalculationType,
    baseLaborMinutes: row.baseLaborMinutes,
    ownMarginBps: row.marginBps,
    recipeYieldPortions: row.recipeYieldPortions,
    fixedPriceCop: row.salePriceCop === null ? null : Number(row.salePriceCop),
    isPublished: row.isPublished,
    components: componentRows.map((component) => ({
      kind: component.supplyId === null ? 'product' : 'supply',
      referenceId: component.supplyId ?? component.componentProductId ?? '',
      quantity: component.quantityFraction,
    })),
    optionGroups: groups,
  };
  const product = Product.create(input);
  if (!product.ok) throw new Error('Persisted product is invalid.');
  return { id: row.id, categoryId: row.categoryId, ...product.value };
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
    return this.database
      .select({
        id: products.id,
        categoryId: products.categoryId,
        name: products.name,
        calculationType: products.calculationType,
        isPublished: products.isPublished,
      })
      .from(products)
      .where(isNull(products.deletedAt))
      .orderBy(asc(products.name)) as Promise<readonly ProductSummary[]>;
  }

  async findActive(id: string): Promise<ProductRecord | null> {
    const [row] = await this.database.select().from(products).where(active(id));
    return row ? asRecord(this.database, row) : null;
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
        const [row] = await transaction
          .insert(products)
          .values({ ...columns(product), categoryId })
          .returning();
        await writeTree(transaction, row.id, product);
        await transaction.insert(auditLogs).values(auditValues(audit));
        return { ok: true, product: await asRecord(transaction, row) };
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
        const [row] = await transaction
          .update(products)
          .set({ ...columns(product), categoryId, updatedAt: new Date() })
          .where(active(id))
          .returning();
        if (!row) return { ok: false, reason: 'not_found' };
        await writeTree(transaction, row.id, product);
        await transaction.insert(auditLogs).values(auditValues(audit));
        return { ok: true, product: await asRecord(transaction, row) };
      }),
    );
  }

  async archive(id: string, audit: AuditEvent): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const now = new Date();
      const [row] = await transaction
        .update(products)
        .set({ deletedAt: now, updatedAt: now })
        .where(active(id))
        .returning({ id: products.id });
      if (!row) return false;
      await transaction.insert(auditLogs).values(auditValues(audit));
      return true;
    });
  }
}
