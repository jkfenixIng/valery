import { describe, expect, it, vi } from 'vitest';

import { AuditEvent } from '../../auth/domain/audit-event';
import { auditLogs, settings } from '@/shared/infrastructure/db/schema';
import {
  DrizzlePricingSettingsRepository,
  pricingSettingKeys,
} from './drizzle-pricing-settings-repository';

const audit = () =>
  AuditEvent.create({
    eventType: 'pricing.settings.updated',
    outcome: 'success',
    actorUserId: 'actor-id',
  });

const record = {
  hourlyRateCop: '8000',
  marginBps: '4000',
  overheadBps: '1000',
  priceRoundingMultipleCop: '500',
};

const pricingDatabase = (failure?: Error) => {
  const onConflictDoUpdate = vi.fn<(conflict: unknown) => Promise<void>>(() =>
    failure ? Promise.reject(failure) : Promise.resolve(),
  );
  const values = vi.fn((value: unknown) =>
    Object.assign(Promise.resolve(value), { onConflictDoUpdate }),
  );
  const insert = vi.fn((table: unknown) => {
    void table;
    return { values };
  });
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
    callback({ insert }),
  );

  return {
    database: { transaction } as never,
    transaction,
    insert,
    values,
    onConflictDoUpdate,
  };
};

describe('DrizzlePricingSettingsRepository', () => {
  it('upserts canonical keys and writes the audit after every settings write', async () => {
    const mock = pricingDatabase();
    const repository = new DrizzlePricingSettingsRepository(mock.database);

    await repository.save(record, audit());

    expect(mock.transaction).toHaveBeenCalledOnce();
    expect(mock.insert.mock.calls.map(([table]) => table)).toEqual([
      settings,
      settings,
      settings,
      settings,
      auditLogs,
    ]);
    expect(mock.values.mock.calls.slice(0, 4).map(([value]) => value)).toEqual([
      { key: pricingSettingKeys.hourlyRateCop, value: '8000' },
      { key: pricingSettingKeys.marginBps, value: '4000' },
      { key: pricingSettingKeys.overheadBps, value: '1000' },
      { key: pricingSettingKeys.priceRoundingMultipleCop, value: '500' },
    ]);
    expect(mock.onConflictDoUpdate).toHaveBeenNthCalledWith(1, {
      target: settings.key,
      set: { value: '8000' },
    });
    expect(mock.values).toHaveBeenLastCalledWith({
      actorUserId: 'actor-id',
      eventType: 'pricing.settings.updated',
      metadata: {},
      outcome: 'success',
      subjectHash: null,
    });
  });

  it('propagates a settings write failure without inserting an audit event', async () => {
    const failure = new Error('write failed');
    const mock = pricingDatabase(failure);
    const repository = new DrizzlePricingSettingsRepository(mock.database);

    await expect(repository.save(record, audit())).rejects.toThrow(failure);
    expect(mock.insert).toHaveBeenCalledOnce();
    expect(mock.insert).toHaveBeenCalledWith(settings);
  });

  it('maps persisted rows to the canonical record fields', async () => {
    const select = vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([
          { key: pricingSettingKeys.hourlyRateCop, value: '8000' },
          { key: pricingSettingKeys.marginBps, value: '4000' },
        ]),
      })),
    }));
    const repository = new DrizzlePricingSettingsRepository({
      select,
    } as never);

    await expect(repository.load()).resolves.toEqual({
      hourlyRateCop: '8000',
      marginBps: '4000',
      overheadBps: undefined,
      priceRoundingMultipleCop: undefined,
    });
  });
});
