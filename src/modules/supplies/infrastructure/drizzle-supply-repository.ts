import { and, asc, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import {
  auditLogs,
  categories,
  supplies,
} from '@/shared/infrastructure/db/schema';

import type { AuditEvent } from '../../auth/domain/audit-event';
import type {
  SupplyCategory,
  SupplyRecord,
  SupplyRepository,
  SupplyWriteResult,
} from '../application/supply-repository';
import type { SupplyDetails } from '../domain/supply';

const asRecord = (row: typeof supplies.$inferSelect): SupplyRecord => ({
  id: row.id,
  categoryId: row.categoryId,
  name: row.name,
  unit: row.unit,
  unitCostCop: Number(row.unitCostCop),
});

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

const columns = (supply: SupplyDetails) => ({
  name: supply.name,
  unit: supply.unit,
  unitCostCop: BigInt(supply.unitCostCop),
});

/** PostgreSQL error codes, possibly wrapped by Drizzle in `cause`. */
const postgresCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'cause' in error ? postgresCode(error.cause) : undefined;
};

const uniqueViolation = '23505';
const foreignKeyViolation = '23503';

/**
 * A failed statement aborts the transaction, so constraint violations are
 * mapped after the rollback; the audit row is never committed on failure.
 */
const mapConstraintViolation = async (
  write: () => Promise<SupplyWriteResult>,
): Promise<SupplyWriteResult> => {
  try {
    return await write();
  } catch (error) {
    const code = postgresCode(error);
    if (code === uniqueViolation) return { ok: false, reason: 'name_taken' };
    if (code === foreignKeyViolation) {
      return { ok: false, reason: 'category_not_found' };
    }
    throw error;
  }
};

const active = (id: string) =>
  and(eq(supplies.id, id), isNull(supplies.deletedAt));

export class DrizzleSupplyRepository implements SupplyRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async listActive(): Promise<readonly SupplyRecord[]> {
    const rows = await this.database
      .select()
      .from(supplies)
      .where(isNull(supplies.deletedAt))
      .orderBy(asc(supplies.name));
    return rows.map(asRecord);
  }

  async findActive(id: string): Promise<SupplyRecord | null> {
    const [row] = await this.database.select().from(supplies).where(active(id));
    return row ? asRecord(row) : null;
  }

  async listCategories(): Promise<readonly SupplyCategory[]> {
    return this.database
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name));
  }

  create(
    categoryId: string,
    supply: SupplyDetails,
    audit: AuditEvent,
  ): Promise<SupplyWriteResult> {
    return mapConstraintViolation(() =>
      this.database.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(supplies)
          .values({ ...columns(supply), categoryId })
          .returning();
        await transaction.insert(auditLogs).values(auditValues(audit));
        return { ok: true, supply: asRecord(row) };
      }),
    );
  }

  update(
    id: string,
    supply: SupplyDetails,
    audit: AuditEvent,
  ): Promise<SupplyWriteResult> {
    return mapConstraintViolation(() =>
      this.database.transaction(async (transaction) => {
        const [row] = await transaction
          .update(supplies)
          .set({ ...columns(supply), updatedAt: new Date() })
          .where(active(id))
          .returning();
        if (!row) return { ok: false, reason: 'not_found' };
        await transaction.insert(auditLogs).values(auditValues(audit));
        return { ok: true, supply: asRecord(row) };
      }),
    );
  }

  async archive(id: string, audit: AuditEvent): Promise<boolean> {
    return this.database.transaction(async (transaction) => {
      const now = new Date();
      const [row] = await transaction
        .update(supplies)
        .set({ deletedAt: now, updatedAt: now })
        .where(active(id))
        .returning({ id: supplies.id });
      if (!row) return false;
      await transaction.insert(auditLogs).values(auditValues(audit));
      return true;
    });
  }
}
