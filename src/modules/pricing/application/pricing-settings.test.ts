import { describe, expect, it } from 'vitest';

import { Money } from '../../../shared/domain/Money';
import type { AuditEvent } from '../../auth/domain/audit-event';
import type { PricingSettingsRecord } from '../domain/pricing-settings';
import { Quantity } from '../domain/quantity';
import {
  getPricingSettings,
  previewPricing,
  updatePricingSettings,
} from './pricing-settings';
import type { PricingSettingsRepository } from './pricing-settings-repository';

class InMemoryPricingSettingsRepository implements PricingSettingsRepository {
  readonly audits: AuditEvent[] = [];

  constructor(public record: Partial<PricingSettingsRecord> = {}) {}

  async load() {
    return this.record;
  }

  async save(record: PricingSettingsRecord, audit: AuditEvent) {
    this.record = record;
    this.audits.push(audit);
  }
}

const pesos = (amount: number) => {
  const money = Money.fromPesos(amount);
  if (!money.ok) throw new Error(`Invalid test money: ${amount}`);
  return money.value;
};

// PRD section 17 sample parameters; test data only, never Valery's defaults.
const input = {
  hourlyRateCop: '8000',
  marginPercent: '40',
  overheadPercent: '10',
  priceRoundingMultipleCop: '500',
};

describe('getPricingSettings', () => {
  it('reports not configured when nothing was saved', async () => {
    await expect(
      getPricingSettings(new InMemoryPricingSettingsRepository()),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRICING_SETTINGS_NOT_CONFIGURED' },
    });
  });

  it('reports corrupt stored data as invalid', async () => {
    const repository = new InMemoryPricingSettingsRepository({
      hourlyRateCop: '8000',
      marginBps: 'abc',
      overheadBps: '1000',
      priceRoundingMultipleCop: '500',
    });

    await expect(getPricingSettings(repository)).resolves.toEqual({
      ok: false,
      error: { code: 'PRICING_SETTINGS_INVALID', fields: ['marginBps'] },
    });
  });
});

describe('updatePricingSettings', () => {
  it('saves canonical values with one audit event and loads them back', async () => {
    const repository = new InMemoryPricingSettingsRepository();

    const saved = await updatePricingSettings(repository, {
      actorUserId: 'admin-1',
      input: { ...input, marginPercent: '40,5' },
    });

    expect(saved.ok).toBe(true);
    expect(repository.record).toEqual({
      hourlyRateCop: '8000',
      marginBps: '4050',
      overheadBps: '1000',
      priceRoundingMultipleCop: '500',
    });
    expect(repository.audits.map((audit) => audit.toRecord())).toEqual([
      {
        eventType: 'pricing.settings.updated',
        outcome: 'success',
        actorUserId: 'admin-1',
        subjectHash: null,
        metadata: {},
      },
    ]);
    await expect(getPricingSettings(repository)).resolves.toEqual(saved);
  });

  it('rejects invalid input without writing', async () => {
    const repository = new InMemoryPricingSettingsRepository();

    await expect(
      updatePricingSettings(repository, {
        actorUserId: 'admin-1',
        input: { ...input, marginPercent: '100' },
      }),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRICING_SETTINGS_INVALID', fields: ['marginPercent'] },
    });
    expect(repository.record).toEqual({});
    expect(repository.audits).toEqual([]);
  });

  it.each([null, ''])(
    'rejects actor %p without writing',
    async (actorUserId) => {
      const repository = new InMemoryPricingSettingsRepository();

      await expect(
        updatePricingSettings(repository, { actorUserId, input }),
      ).resolves.toEqual({ ok: false, error: { code: 'UNAUTHORIZED' } });
      expect(repository.record).toEqual({});
      expect(repository.audits).toEqual([]);
    },
  );
});

describe('previewPricing', () => {
  const caseA = {
    materials: [{ quantity: Quantity.fromInteger(1), unitCost: pesos(20_000) }],
    components: [],
    laborMinutes: 90,
  };
  const costInput = () => {
    const [line] = caseA.materials;
    if (!line.quantity.ok) throw new Error('Invalid test quantity');
    return {
      ...caseA,
      materials: [{ ...line, quantity: line.quantity.value }],
    };
  };

  it('prices PRD golden case A with the saved settings', async () => {
    const repository = new InMemoryPricingSettingsRepository();
    await updatePricingSettings(repository, { actorUserId: 'admin-1', input });

    const preview = await previewPricing(repository, costInput());

    expect(preview.ok && preview.value.cost.total).toEqual(pesos(34_000));
    expect(preview.ok && preview.value.suggestedPrice).toEqual(pesos(57_000));
  });

  it('refuses to price before settings are configured', async () => {
    await expect(
      previewPricing(new InMemoryPricingSettingsRepository(), costInput()),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'PRICING_SETTINGS_NOT_CONFIGURED' },
    });
  });
});
