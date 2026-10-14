import { err, ok, type Result } from '../../../shared/domain/Result';
import { AuditEvent } from '../../auth/domain/audit-event';
import {
  isProductReference,
  Product,
  type ProductDetails,
  type ProductInput,
  type ProductInvalid,
} from '../domain/product';
import type {
  ProductRecord,
  ProductRepository,
  ProductWriteResult,
} from './product-repository';

export type ProductMutationError =
  | ProductInvalid
  | Readonly<{
      code:
        | 'UNAUTHORIZED'
        | 'PRODUCT_NOT_FOUND'
        | 'PRODUCT_CATEGORY_NOT_FOUND'
        | 'PRODUCT_NAME_TAKEN';
    }>;

export type SaveProductCommand = Readonly<{
  actorUserId: string | null;
  categoryId: string;
  input: ProductInput;
}>;

export type UpdateProductCommand = SaveProductCommand &
  Readonly<{ productId: string }>;

export type ArchiveProductCommand = Readonly<{
  actorUserId: string | null;
  productId: string;
}>;

type ProductEvent = 'product.created' | 'product.updated' | 'product.archived';
type MutationResult = Promise<Result<ProductRecord, ProductMutationError>>;

const unauthorized = err({ code: 'UNAUTHORIZED' } as const);
const notFound = err({ code: 'PRODUCT_NOT_FOUND' } as const);
const categoryNotFound = err({ code: 'PRODUCT_CATEGORY_NOT_FOUND' } as const);

const isActor = (actorUserId: string | null): actorUserId is string =>
  Boolean(actorUserId?.trim());

/** Only actor, action and time are audited; never product data. */
const auditEvent = (eventType: ProductEvent, actorUserId: string) =>
  AuditEvent.create({
    eventType,
    outcome: 'success',
    actorUserId,
    metadata: { method: 'admin_product_form' },
  });

const toResult = (
  written: ProductWriteResult,
): Result<ProductRecord, ProductMutationError> => {
  if (written.ok) return ok(written.product);
  if (written.reason === 'name_taken')
    return err({ code: 'PRODUCT_NAME_TAKEN' });
  if (written.reason === 'category_not_found') return categoryNotFound;
  if (written.reason === 'reference_not_found') {
    // A referenced supply or product was archived or removed concurrently.
    return err({ code: 'PRODUCT_INVALID', fields: ['components'] });
  }
  return notFound;
};

const lower = (ids: readonly { id: string }[]) =>
  new Set(ids.map(({ id }) => id.toLowerCase()));

/**
 * References must point to active supplies and to eligible (active,
 * non-bundle) products other than the product itself.
 */
const unknownReferences = async (
  repository: ProductRepository,
  details: ProductDetails,
  productId?: string,
): Promise<string[]> => {
  const [supplies, products] = await Promise.all([
    repository.listActiveSupplies(),
    repository.listBundleProducts(),
  ]);
  const supplyIds = lower(supplies);
  const productIds = lower(products);
  productIds.delete(productId?.toLowerCase() ?? '');

  const components = details.components.flatMap((component, index) => {
    const ids = component.kind === 'supply' ? supplyIds : productIds;
    return ids.has(component.referenceId.toLowerCase())
      ? []
      : [`components.${index}.referenceId`];
  });
  const options = details.optionGroups.flatMap((group, groupIndex) =>
    group.values.flatMap((value, valueIndex) =>
      value.components.flatMap((component, index) =>
        supplyIds.has(component.supplyId.toLowerCase())
          ? []
          : [
              `optionGroups.${groupIndex}.values.${valueIndex}.components.${index}.supplyId`,
            ],
      ),
    ),
  );
  return [...components, ...options];
};

const validated = async (
  repository: ProductRepository,
  command: SaveProductCommand,
  productId?: string,
): Promise<Result<ProductDetails, ProductMutationError>> => {
  const product = Product.create(command.input);
  if (!product.ok) return product;
  if (!isProductReference(command.categoryId)) return categoryNotFound;

  const fields = await unknownReferences(repository, product.value, productId);
  return fields.length > 0 ? err({ code: 'PRODUCT_INVALID', fields }) : product;
};

export const listActiveProducts = (repository: ProductRepository) =>
  repository.listActive();

export const listProductCategories = (repository: ProductRepository) =>
  repository.listCategories();

export const listProductSupplies = (repository: ProductRepository) =>
  repository.listActiveSupplies();

export const listBundleProducts = (repository: ProductRepository) =>
  repository.listBundleProducts();

export const getActiveProduct = async (
  repository: ProductRepository,
  productId: string,
): Promise<ProductRecord | null> =>
  isProductReference(productId) ? repository.findActive(productId) : null;

export const createProduct = async (
  repository: ProductRepository,
  command: SaveProductCommand,
): MutationResult => {
  if (!isActor(command.actorUserId)) return unauthorized;

  const product = await validated(repository, command);
  if (!product.ok) return product;

  return toResult(
    await repository.create(
      command.categoryId,
      product.value,
      auditEvent('product.created', command.actorUserId),
    ),
  );
};

/** Saves the product only; dependent cost recalculation belongs to F1-05. */
export const updateProduct = async (
  repository: ProductRepository,
  command: UpdateProductCommand,
): MutationResult => {
  if (!isActor(command.actorUserId)) return unauthorized;
  if (!isProductReference(command.productId)) return notFound;

  const product = await validated(repository, command, command.productId);
  if (!product.ok) return product;

  return toResult(
    await repository.update(
      command.productId,
      command.categoryId,
      product.value,
      auditEvent('product.updated', command.actorUserId),
    ),
  );
};

export const archiveProduct = async (
  repository: ProductRepository,
  command: ArchiveProductCommand,
): Promise<Result<void, ProductMutationError>> => {
  if (!isActor(command.actorUserId)) return unauthorized;
  if (!isProductReference(command.productId)) return notFound;

  const archived = await repository.archive(
    command.productId,
    auditEvent('product.archived', command.actorUserId),
  );
  return archived ? ok(undefined) : notFound;
};
