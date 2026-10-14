import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';

import { AuditEvent } from '../../auth/domain/audit-event';
import { auditLogs, supplies } from '@/shared/infrastructure/db/schema';
import { DrizzleSupplyRepository } from './drizzle-supply-repository';

const dialect = new PgDialect();
const audit = (
  eventType: 'supply.created' | 'supply.updated' | 'supply.archived',
) =>
  AuditEvent.create({
    eventType,
    outcome: 'success',
    actorUserId: 'actor-id',
    metadata: { method: 'admin_supply_form' },
  });

const details = { name: 'Harina', unit: 'g', unitCostCop: 12 };
const row = {
  id: 'supply-id',
  categoryId: 'category-id',
  name: 'Harina',
  unit: 'g',
  unitCostCop: 12n,
};

const supplyDatabase = (
  write: Promise<readonly [typeof row]> = Promise.resolve([row]),
) => {
  const where = vi.fn((condition: unknown) => {
    void condition;
    return { returning: vi.fn(() => write) };
  });
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const returning = vi.fn(() => write);
  const values = vi.fn((value: unknown) => {
    void value;
    return { returning };
  });
  const insert = vi.fn((table: unknown) => {
    void table;
    return { values };
  });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ insert, update }),
  );

  return {
    database: { transaction } as never,
    transaction,
    insert,
    values,
    update,
    where,
  };
};

const sql = (condition: unknown) => dialect.sqlToQuery(condition as never).sql;

describe('DrizzleSupplyRepository', () => {
  it('creates a canonical supply and audits it in the same transaction', async () => {
    const mock = supplyDatabase();
    const repository = new DrizzleSupplyRepository(mock.database);

    await expect(
      repository.create('category-id', details, audit('supply.created')),
    ).resolves.toEqual({
      ok: true,
      supply: { ...details, id: 'supply-id', categoryId: 'category-id' },
    });

    expect(mock.transaction).toHaveBeenCalledOnce();
    expect(mock.insert.mock.calls.map(([table]) => table)).toEqual([
      supplies,
      auditLogs,
    ]);
    expect(mock.values).toHaveBeenNthCalledWith(1, {
      categoryId: 'category-id',
      name: 'Harina',
      unit: 'g',
      unitCostCop: 12n,
    });
  });

  it('does not audit a failed aggregate write and maps a unique violation', async () => {
    const uniqueViolation = Object.assign(new Error('duplicate'), {
      code: '23505',
    });
    const mock = supplyDatabase(Promise.reject(uniqueViolation));
    const repository = new DrizzleSupplyRepository(mock.database);

    await expect(
      repository.create('category-id', details, audit('supply.created')),
    ).resolves.toEqual({
      ok: false,
      reason: 'name_taken',
    });
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.insert).toHaveBeenCalledWith(supplies);
  });

  it.each([
    [
      'update',
      (repository: DrizzleSupplyRepository) =>
        repository.update('supply-id', details, audit('supply.updated')),
    ],
    [
      'archive',
      (repository: DrizzleSupplyRepository) =>
        repository.archive('supply-id', audit('supply.archived')),
    ],
  ])(
    'targets only active rows when it %s a supply',
    async (_operation, execute) => {
      const mock = supplyDatabase();
      const repository = new DrizzleSupplyRepository(mock.database);

      await execute(repository);

      expect(sql(mock.where.mock.calls[0]?.[0])).toContain(
        '"supplies"."deleted_at" is null',
      );
      expect(sql(mock.where.mock.calls[0]?.[0])).toContain(
        '"supplies"."id" = $1',
      );
    },
  );

  it('maps an active persisted row to the application record', async () => {
    const where = vi.fn().mockResolvedValue([row]);
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where })) }));
    const repository = new DrizzleSupplyRepository({ select } as never);

    await expect(repository.findActive('supply-id')).resolves.toEqual({
      ...details,
      id: 'supply-id',
      categoryId: 'category-id',
    });
  });
});
