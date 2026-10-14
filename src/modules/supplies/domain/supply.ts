import { err, ok, type Result } from '../../../shared/domain/Result';

/**
 * Technical safeguards against oversized input, not business rules.
 * Columns stay `text`; this domain validation is authoritative.
 */
export const supplyLimits = { nameMaxLength: 120, unitMaxLength: 32 } as const;

export type SupplyField = 'name' | 'unit' | 'unitCostCop';

export type SupplyInput = Readonly<{
  name: string;
  unit: string;
  unitCostCop: number;
}>;

/** Validated supply data: trimmed text and a whole, nonnegative COP cost. */
export type SupplyDetails = SupplyInput;

export type SupplyInvalid = Readonly<{
  code: 'SUPPLY_INVALID';
  fields: readonly string[];
}>;

const isBoundedText = (value: string, maxLength: number) =>
  value.length > 0 && value.length <= maxLength;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSupplyReference = (value: string): boolean =>
  uuidPattern.test(value);

export const Supply = {
  create(input: SupplyInput): Result<SupplyDetails, SupplyInvalid> {
    const name = input.name.trim();
    const unit = input.unit.trim();
    const fields: SupplyField[] = [];

    if (!isBoundedText(name, supplyLimits.nameMaxLength)) fields.push('name');
    if (!isBoundedText(unit, supplyLimits.unitMaxLength)) fields.push('unit');
    if (!Number.isSafeInteger(input.unitCostCop) || input.unitCostCop < 0) {
      fields.push('unitCostCop');
    }

    if (fields.length > 0) return err({ code: 'SUPPLY_INVALID', fields });
    return ok({ name, unit, unitCostCop: input.unitCostCop });
  },
} as const;
