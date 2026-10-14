import type { AuditEvent } from '../../auth/domain/audit-event';
import type { CalculationType, ProductDetails } from '../domain/product';

export type ProductRecord = Readonly<{ id: string; categoryId: string }> &
  ProductDetails;

export type ProductSummary = Readonly<{
  id: string;
  categoryId: string;
  name: string;
  calculationType: CalculationType;
  isPublished: boolean;
}>;

export type ProductCategory = Readonly<{ id: string; name: string }>;

export type ProductSupplyOption = Readonly<{
  id: string;
  name: string;
  unit: string;
}>;

export type BundleProductOption = Readonly<{ id: string; name: string }>;

/** Write failures the store detects atomically, without throwing. */
export type ProductWriteFailure =
  'not_found' | 'category_not_found' | 'name_taken' | 'reference_not_found';

export type ProductWriteResult =
  | Readonly<{ ok: true; product: ProductRecord }>
  | Readonly<{ ok: false; reason: ProductWriteFailure }>;

/**
 * Every mutation affects active products only and writes the product, its
 * components and option tree, and its audit event in one transaction; a
 * failed mutation writes nothing, including the audit row.
 */
export interface ProductRepository {
  listActive(): Promise<readonly ProductSummary[]>;
  findActive(id: string): Promise<ProductRecord | null>;
  listCategories(): Promise<readonly ProductCategory[]>;
  listActiveSupplies(): Promise<readonly ProductSupplyOption[]>;
  /** Active, non-bundle products: bundles never nest, so costs stay acyclic. */
  listBundleProducts(): Promise<readonly BundleProductOption[]>;
  create(
    categoryId: string,
    product: ProductDetails,
    audit: AuditEvent,
  ): Promise<ProductWriteResult>;
  update(
    id: string,
    categoryId: string,
    product: ProductDetails,
    audit: AuditEvent,
  ): Promise<ProductWriteResult>;
  archive(id: string, audit: AuditEvent): Promise<boolean>;
}
