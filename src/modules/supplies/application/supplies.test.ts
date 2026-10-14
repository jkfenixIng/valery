import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../../auth/domain/audit-event';
import type { SupplyDetails } from '../domain/supply';
import {
  archiveSupply,
  createSupply,
  getActiveSupply,
  listActiveSupplies,
  updateSupply,
} from './supplies';
import type {
  SupplyCategory,
  SupplyRecord,
  SupplyRepository,
  SupplyWriteResult,
} from './supply-repository';

type StoredSupply = SupplyRecord & { archived: boolean };

class InMemorySupplyRepository implements SupplyRepository {
  readonly audits: AuditEvent[] = [];
  readonly rows: StoredSupply[] = [];

  constructor(readonly categories: SupplyCategory[]) {}

  async listActive() {
    return this.rows.filter((row) => !row.archived).map(toRecord);
  }

  async findActive(id: string) {
    const row = this.active(id);
    return row ? toRecord(row) : null;
  }

  async listCategories() {
    return this.categories;
  }

  async create(
    categoryId: string,
    supply: SupplyDetails,
    audit: AuditEvent,
  ): Promise<SupplyWriteResult> {
    if (!this.categories.some((category) => category.id === categoryId)) {
      return { ok: false, reason: 'category_not_found' };
    }
    // Mirrors unique(category_id, name), which also covers archived rows.
    if (this.taken(categoryId, supply.name)) {
      return { ok: false, reason: 'name_taken' };
    }
    const row = { id: randomUUID(), categoryId, ...supply, archived: false };
    this.rows.push(row);
    this.audits.push(audit);
    return { ok: true, supply: toRecord(row) };
  }

  async update(
    id: string,
    supply: SupplyDetails,
    audit: AuditEvent,
  ): Promise<SupplyWriteResult> {
    const row = this.active(id);
    if (!row) return { ok: false, reason: 'not_found' };
    if (this.taken(row.categoryId, supply.name, id)) {
      return { ok: false, reason: 'name_taken' };
    }
    Object.assign(row, supply);
    this.audits.push(audit);
    return { ok: true, supply: toRecord(row) };
  }

  async archive(id: string, audit: AuditEvent) {
    const row = this.active(id);
    if (!row) return false;
    row.archived = true;
    this.audits.push(audit);
    return true;
  }

  private active(id: string) {
    return this.rows.find((row) => row.id === id && !row.archived);
  }

  private taken(categoryId: string, name: string, exceptId?: string) {
    return this.rows.some(
      (row) =>
        row.categoryId === categoryId &&
        row.name === name &&
        row.id !== exceptId,
    );
  }
}

const toRecord = (row: StoredSupply): SupplyRecord => ({
  id: row.id,
  categoryId: row.categoryId,
  name: row.name,
  unit: row.unit,
  unitCostCop: row.unitCostCop,
});

const categoryId = randomUUID();
const actorUserId = 'admin-1';
const input = { name: ' Harina ', unit: 'g', unitCostCop: 12 };

const setup = () =>
  new InMemorySupplyRepository([{ id: categoryId, name: 'Postres' }]);

const created = async (repository: InMemorySupplyRepository) => {
  const result = await createSupply(repository, {
    actorUserId,
    categoryId,
    input,
  });
  if (!result.ok) throw new Error('Test supply was not created.');
  return result.value;
};

const auditTrail = (repository: InMemorySupplyRepository) =>
  repository.audits.map((audit) => audit.toRecord());

describe('supplies use cases', () => {
  it('creates, edits and archives an active supply with one audit event each', async () => {
    const repository = setup();
    const supply = await created(repository);

    const updated = await updateSupply(repository, {
      actorUserId,
      supplyId: supply.id,
      input: { name: 'Harina de trigo', unit: 'kg', unitCostCop: 0 },
    });
    expect(updated).toEqual({
      ok: true,
      value: {
        id: supply.id,
        categoryId,
        name: 'Harina de trigo',
        unit: 'kg',
        unitCostCop: 0,
      },
    });

    await expect(
      archiveSupply(repository, { actorUserId, supplyId: supply.id }),
    ).resolves.toEqual({ ok: true, value: undefined });
    await expect(listActiveSupplies(repository)).resolves.toEqual([]);
    await expect(getActiveSupply(repository, supply.id)).resolves.toBeNull();

    expect(auditTrail(repository)).toEqual(
      ['supply.created', 'supply.updated', 'supply.archived'].map(
        (eventType) => ({
          eventType,
          outcome: 'success',
          actorUserId,
          subjectHash: null,
          metadata: { method: 'admin_supply_form' },
        }),
      ),
    );
  });

  it.each([null, '', '   '])(
    'rejects actor %p for every mutation without writing',
    async (actor) => {
      const repository = setup();
      const supplyId = (await created(repository)).id;
      const auditCount = repository.audits.length;
      const unauthorized = { ok: false, error: { code: 'UNAUTHORIZED' } };

      await expect(
        createSupply(repository, { actorUserId: actor, categoryId, input }),
      ).resolves.toEqual(unauthorized);
      await expect(
        updateSupply(repository, { actorUserId: actor, supplyId, input }),
      ).resolves.toEqual(unauthorized);
      await expect(
        archiveSupply(repository, { actorUserId: actor, supplyId }),
      ).resolves.toEqual(unauthorized);
      expect(repository.audits).toHaveLength(auditCount);
    },
  );

  it.each([
    ['unknown', randomUUID()],
    ['malformed', 'not-a-uuid'],
  ])('rejects editing or archiving a %s supply', async (_, supplyId) => {
    const repository = setup();
    const notFound = { ok: false, error: { code: 'SUPPLY_NOT_FOUND' } };

    await expect(
      updateSupply(repository, { actorUserId, supplyId, input }),
    ).resolves.toEqual(notFound);
    await expect(
      archiveSupply(repository, { actorUserId, supplyId }),
    ).resolves.toEqual(notFound);
    expect(repository.audits).toEqual([]);
  });

  it('rejects editing or archiving an already archived supply', async () => {
    const repository = setup();
    const supplyId = (await created(repository)).id;
    await archiveSupply(repository, { actorUserId, supplyId });
    const notFound = { ok: false, error: { code: 'SUPPLY_NOT_FOUND' } };

    await expect(
      updateSupply(repository, { actorUserId, supplyId, input }),
    ).resolves.toEqual(notFound);
    await expect(
      archiveSupply(repository, { actorUserId, supplyId }),
    ).resolves.toEqual(notFound);
    expect(repository.audits).toHaveLength(2);
  });

  it('keeps an archived name reserved in its category (current unique constraint)', async () => {
    const repository = setup();
    const supplyId = (await created(repository)).id;
    await archiveSupply(repository, { actorUserId, supplyId });

    await expect(
      createSupply(repository, { actorUserId, categoryId, input }),
    ).resolves.toEqual({ ok: false, error: { code: 'SUPPLY_NAME_TAKEN' } });
  });

  it('rejects invalid input and unknown categories without writing', async () => {
    const repository = setup();

    await expect(
      createSupply(repository, {
        actorUserId,
        categoryId,
        input: { ...input, unitCostCop: -1 },
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'SUPPLY_INVALID', fields: ['unitCostCop'] },
    });
    await expect(
      createSupply(repository, {
        actorUserId,
        categoryId: randomUUID(),
        input,
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'SUPPLY_CATEGORY_NOT_FOUND' },
    });
    expect(repository.rows).toEqual([]);
    expect(repository.audits).toEqual([]);
  });
});
