import type { AuditEvent } from '../../auth/domain/audit-event';
import type {
  CalculationType,
  ProductDetails,
  ProductInput,
} from '../domain/product';

export type ProductRecord = Readonly<{ id: string; categoryId: string }> &
  ProductDetails;

/**
 * A persisted product as editable input. Rows written before the current
 * rules (e.g. legacy rows classified `fixed_price` by migration 0004) are
 * returned unchanged with the domain paths they violate, so they can be
 * reviewed and fixed instead of failing the read.
 */
export type StoredProduct = Readonly<{
  id: string;
  categoryId: string;
  input: ProductInput;
  /** Empty when the row satisfies the current domain rules. */
  validationIssues: readonly string[];
}>;

export type ProductSummary = Readonly<{
  id: string;
  categoryId: string;
  name: string;
  calculationType: CalculationType;
  isPublished: boolean;
  needsReview: boolean;
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
  | 'not_found'
  | 'category_not_found'
  | 'name_taken'
  | 'reference_not_found'
  /** The product is a component of another bundle, and bundles never nest. */
  | 'used_as_bundle_component';

export type ProductWriteResult =
  | Readonly<{ ok: true; product: ProductRecord }>
  | Readonly<{ ok: false; reason: ProductWriteFailure }>
  /** Component products that are missing, archived, bundles, or the product itself. */
  | Readonly<{
      ok: false;
      reason: 'component_ineligible';
      fields: readonly string[];
    }>;

export type ProductArchiveResult =
  'archived' | 'not_found' | 'in_use_by_bundle';

/**
 * Every mutation affects active products only and writes the product, its
 * components and option tree, and its audit event in one transaction; a
 * failed mutation writes nothing, including the audit row. Bundle integrity
 * (component eligibility, no nesting, no archiving of used components) is
 * checked inside that transaction on locked product rows, so it is
 * authoritative even under concurrent writes.
 */
export interface ProductRepository {
  listActive(): Promise<readonly ProductSummary[]>;
  findActive(id: string): Promise<StoredProduct | null>;
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
  archive(id: string, audit: AuditEvent): Promise<ProductArchiveResult>;
}
