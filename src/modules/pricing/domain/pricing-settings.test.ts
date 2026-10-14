import { describe, expect, it } from 'vitest';

import { Money } from '../../../shared/domain/Money';
import {
  parsePricingSettings,
  restorePricingSettings,
  toPricingSettingsInput,
  toPricingSettingsRecord,
  type PricingSettingsInput,
} from './pricing-settings';

const pesos = (amount: number) => {
  const money = Money.fromPesos(amount);
  if (!money.ok) throw new Error(`Invalid test money: ${amount}`);
  return money.value;
};

// PRD section 17 sample parameters; test data only, never Valery's defaults.
const input: PricingSettingsInput = {
  hourlyRateCop: '8000',
  marginPercent: '40',
  overheadPercent: '10',
  priceRoundingMultipleCop: '500',
};

const invalid = (...fields: string[]) => ({
  ok: false,
  error: { code: 'PRICING_SETTINGS_INVALID', fields },
});

describe('parsePricingSettings', () => {
  it('converts form text to exact engine settings', () => {
    expect(parsePricingSettings(input)).toEqual({
      ok: true,
      value: {
        hourlyRate: pesos(8_000),
        marginBps: 4_000,
        overheadBps: 1_000,
        priceRoundingMultiple: 500,
      },
    });
  });

  it.each([
    ['0', 0],
    ['40', 4_000],
    ['40.5', 4_050],
    ['40,5', 4_050],
    ['10.25', 1_025],
    ['10,05', 1_005],
    [' 99,99 ', 9_999],
  ])('reads margin %p as %p basis points', (marginPercent, expected) => {
    const result = parsePricingSettings({ ...input, marginPercent });
    expect(result.ok && result.value.marginBps).toBe(expected);
  });

  it('accepts overhead at or above 100%', () => {
    const result = parsePricingSettings({ ...input, overheadPercent: '150,5' });
    expect(result.ok && result.value.overheadBps).toBe(15_050);
  });

  it('accepts a zero hourly rate', () => {
    const result = parsePricingSettings({ ...input, hourlyRateCop: '0' });
    expect(result.ok && result.value.hourlyRate).toEqual(pesos(0));
  });

  it.each([
    ['hourlyRateCop', ''],
    ['hourlyRateCop', '-1'],
    ['hourlyRateCop', '8.000'],
    ['hourlyRateCop', '8000.5'],
    ['hourlyRateCop', '1e3'],
    ['hourlyRateCop', '9007199254740992'],
    ['marginPercent', ''],
    ['marginPercent', '100'],
    ['marginPercent', '-1'],
    ['marginPercent', '10.255'],
    ['marginPercent', '10.'],
    ['marginPercent', '40%'],
    ['overheadPercent', ''],
    ['overheadPercent', '-0,5'],
    ['overheadPercent', '1,234'],
    ['overheadPercent', '99999999999999999'],
    ['priceRoundingMultipleCop', ''],
    ['priceRoundingMultipleCop', '0'],
    ['priceRoundingMultipleCop', '2,5'],
    ['priceRoundingMultipleCop', '-500'],
  ] as const)('rejects %s = %p', (field, value) => {
    expect(parsePricingSettings({ ...input, [field]: value })).toEqual(
      invalid(field),
    );
  });

  it('reports every invalid field at once', () => {
    expect(
      parsePricingSettings({
        hourlyRateCop: 'x',
        marginPercent: 'x',
        overheadPercent: 'x',
        priceRoundingMultipleCop: 'x',
      }),
    ).toEqual(
      invalid(
        'hourlyRateCop',
        'marginPercent',
        'overheadPercent',
        'priceRoundingMultipleCop',
      ),
    );
  });
});

describe('stored pricing settings', () => {
  const record = {
    hourlyRateCop: '8000',
    marginBps: '4000',
    overheadBps: '1000',
    priceRoundingMultipleCop: '500',
  };

  it('round-trips through canonical integer strings', () => {
    const settings = parsePricingSettings({ ...input, marginPercent: '40,25' });
    if (!settings.ok) throw new Error('Unexpected invalid settings');

    const stored = toPricingSettingsRecord(settings.value);
    expect(stored).toEqual({ ...record, marginBps: '4025' });
    expect(restorePricingSettings(stored)).toEqual(settings);
  });

  it('reports missing settings as not configured, never as defaults', () => {
    expect(restorePricingSettings({})).toEqual({
      ok: false,
      error: { code: 'PRICING_SETTINGS_NOT_CONFIGURED' },
    });
  });

  it('treats a partial record as corrupt', () => {
    expect(
      restorePricingSettings({ ...record, overheadBps: undefined }),
    ).toEqual(invalid('overheadBps'));
  });

  it.each([
    ['hourlyRateCop', '08000'],
    ['hourlyRateCop', '8000.0'],
    ['marginBps', '10000'],
    ['marginBps', '40%'],
    ['overheadBps', '-1'],
    ['overheadBps', ''],
    ['priceRoundingMultipleCop', '0'],
  ] as const)('rejects corrupt stored %s = %p', (field, value) => {
    expect(restorePricingSettings({ ...record, [field]: value })).toEqual(
      invalid(field),
    );
  });
});

describe('toPricingSettingsInput', () => {
  it.each([
    [4_000, '40'],
    [4_050, '40,5'],
    [1_025, '10,25'],
    [1_005, '10,05'],
    [0, '0'],
  ])('formats %p basis points as %p', (marginBps, expected) => {
    const settings = parsePricingSettings(input);
    if (!settings.ok) throw new Error('Unexpected invalid settings');

    expect(
      toPricingSettingsInput({ ...settings.value, marginBps }).marginPercent,
    ).toBe(expected);
  });
});
