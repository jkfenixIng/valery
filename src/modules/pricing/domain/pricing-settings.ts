import { Money } from '../../../shared/domain/Money';
import { err, ok, type Result } from '../../../shared/domain/Result';
import type { PricingSettings } from './pricing-calculator';

/** Raw form text. Percentages accept `.` or `,` and up to two decimals. */
export type PricingSettingsInput = Readonly<{
  hourlyRateCop: string;
  marginPercent: string;
  overheadPercent: string;
  priceRoundingMultipleCop: string;
}>;

/** Canonical integer strings, as persisted. */
export type PricingSettingsRecord = Readonly<{
  hourlyRateCop: string;
  marginBps: string;
  overheadBps: string;
  priceRoundingMultipleCop: string;
}>;

export type PricingSettingsError =
  | Readonly<{ code: 'PRICING_SETTINGS_NOT_CONFIGURED' }>
  | Readonly<{ code: 'PRICING_SETTINGS_INVALID'; fields: readonly string[] }>;

const bpsBase = 10_000;
const percentPattern = /^(\d+)(?:[.,](\d{1,2}))?$/;
const integerPattern = /^\d+$/;

const toSafeInteger = (digits: bigint): number | undefined =>
  digits <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(digits) : undefined;

const parseInteger = (text: string): number | undefined => {
  const value = text.trim();
  return integerPattern.test(value) ? toSafeInteger(BigInt(value)) : undefined;
};

/** Exact conversion: `40,25` -> 4025 basis points. */
const parsePercentBps = (text: string): number | undefined => {
  const match = percentPattern.exec(text.trim());
  if (!match) return undefined;

  const [, whole, decimals = ''] = match;
  return toSafeInteger(BigInt(whole) * 100n + BigInt(decimals.padEnd(2, '0')));
};

const parseCanonicalInteger = (
  text: string | undefined,
): number | undefined => {
  if (text === undefined) return undefined;
  const value = parseInteger(text);
  return value !== undefined && String(value) === text ? value : undefined;
};

type Candidate = Readonly<{
  hourlyRate?: number;
  marginBps?: number;
  overheadBps?: number;
  priceRoundingMultiple?: number;
}>;

type FieldNames = Readonly<Record<keyof Candidate, string>>;

const validate = (
  candidate: Candidate,
  names: FieldNames,
): Result<PricingSettings, PricingSettingsError> => {
  const { hourlyRate, marginBps, overheadBps, priceRoundingMultiple } =
    candidate;
  const money =
    hourlyRate === undefined ? undefined : Money.fromPesos(hourlyRate);
  const fields = [
    money?.ok ? undefined : names.hourlyRate,
    marginBps !== undefined && marginBps < bpsBase
      ? undefined
      : names.marginBps,
    overheadBps === undefined ? names.overheadBps : undefined,
    priceRoundingMultiple !== undefined && priceRoundingMultiple > 0
      ? undefined
      : names.priceRoundingMultiple,
  ].filter((field): field is string => field !== undefined);

  if (fields.length > 0 || !money?.ok) {
    return err({ code: 'PRICING_SETTINGS_INVALID', fields });
  }

  return ok({
    hourlyRate: money.value,
    marginBps: marginBps as number,
    overheadBps: overheadBps as number,
    priceRoundingMultiple: priceRoundingMultiple as number,
  });
};

export const parsePricingSettings = (
  input: PricingSettingsInput,
): Result<PricingSettings, PricingSettingsError> =>
  validate(
    {
      hourlyRate: parseInteger(input.hourlyRateCop),
      marginBps: parsePercentBps(input.marginPercent),
      overheadBps: parsePercentBps(input.overheadPercent),
      priceRoundingMultiple: parseInteger(input.priceRoundingMultipleCop),
    },
    {
      hourlyRate: 'hourlyRateCop',
      marginBps: 'marginPercent',
      overheadBps: 'overheadPercent',
      priceRoundingMultiple: 'priceRoundingMultipleCop',
    },
  );

/** Nothing stored means not configured; anything partial or malformed is corrupt. */
export const restorePricingSettings = (
  record: Partial<PricingSettingsRecord>,
): Result<PricingSettings, PricingSettingsError> => {
  if (Object.values(record).every((value) => value === undefined)) {
    return err({ code: 'PRICING_SETTINGS_NOT_CONFIGURED' });
  }

  return validate(
    {
      hourlyRate: parseCanonicalInteger(record.hourlyRateCop),
      marginBps: parseCanonicalInteger(record.marginBps),
      overheadBps: parseCanonicalInteger(record.overheadBps),
      priceRoundingMultiple: parseCanonicalInteger(
        record.priceRoundingMultipleCop,
      ),
    },
    {
      hourlyRate: 'hourlyRateCop',
      marginBps: 'marginBps',
      overheadBps: 'overheadBps',
      priceRoundingMultiple: 'priceRoundingMultipleCop',
    },
  );
};

export const toPricingSettingsRecord = (
  settings: PricingSettings,
): PricingSettingsRecord => ({
  hourlyRateCop: String(settings.hourlyRate.amount),
  marginBps: String(settings.marginBps),
  overheadBps: String(settings.overheadBps),
  priceRoundingMultipleCop: String(settings.priceRoundingMultiple),
});

const formatPercent = (bps: number): string => {
  const whole = Math.trunc(bps / 100);
  const cents = bps % 100;
  if (cents === 0) return String(whole);
  return `${whole},${String(cents).padStart(2, '0').replace(/0$/, '')}`;
};

/** Saved settings as form text, using the Spanish decimal comma. */
export const toPricingSettingsInput = (
  settings: PricingSettings,
): PricingSettingsInput => ({
  hourlyRateCop: String(settings.hourlyRate.amount),
  marginPercent: formatPercent(settings.marginBps),
  overheadPercent: formatPercent(settings.overheadBps),
  priceRoundingMultipleCop: String(settings.priceRoundingMultiple),
});
