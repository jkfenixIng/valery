import type { AuditEvent } from '../../auth/domain/audit-event';
import type { SupplyDetails } from '../domain/supply';

export type SupplyRecord = Readonly<{
  id: string;
  categoryId: string;
  name: string;
  unit: string;
  unitCostCop: number;
}>;

export type SupplyCategory = Readonly<{ id: string; name: string }>;

/** Write failures the store detects atomically, without throwing. */
export type SupplyWriteFailure =
  'not_found' | 'category_not_found' | 'name_taken';

export type SupplyWriteResult =
  | Readonly<{ ok: true; supply: SupplyRecord }>
  | Readonly<{ ok: false; reason: SupplyWriteFailure }>;

/**
 * Every mutation affects active rows only and writes its audit event in the
 * same transaction; a failed mutation writes no audit row.
 */
export interface SupplyRepository {
  listActive(): Promise<readonly SupplyRecord[]>;
  findActive(id: string): Promise<SupplyRecord | null>;
  listCategories(): Promise<readonly SupplyCategory[]>;
  create(
    categoryId: string,
    supply: SupplyDetails,
    audit: AuditEvent,
  ): Promise<SupplyWriteResult>;
  update(
    id: string,
    supply: SupplyDetails,
    audit: AuditEvent,
  ): Promise<SupplyWriteResult>;
  archive(id: string, audit: AuditEvent): Promise<boolean>;
}
