import { Money } from '../../../shared/domain/Money';
import { err, ok, type Result } from '../../../shared/domain/Result';

/** Percentages are integer basis points: 40% = 4000. */
export type PricingSettings = Readonly<{
  hourlyRate: Money;
  overheadBps: number;
  marginBps: number;
  priceRoundingMultiple: number;
}>;

export type CostLine = Readonly<{
  quantity: number;
  unitCost: Money;
}>;

/**
 * `materials` are the product's own supplies. `components` are included
 * products priced at their total cost; they receive no labor or overhead.
 */
export type CostInput = Readonly<{
  materials: readonly CostLine[];
  components: readonly CostLine[];
  laborMinutes: number;
}>;

export type CostBreakdown = Readonly<{
  materials: Money;
  components: Money;
  labor: Money;
  overhead: Money;
  total: Money;
}>;

/** `profit` is signed COP because a manual price may be below cost. */
export type ProfitEvaluation = Readonly<{
  profit: number;
  profitBps: number;
  isBelowMinimum: boolean;
}>;

export type LineInput = Readonly<{
  unitPrice: Money;
  unitCost: Money;
  quantity: number;
}>;

export type LineTotal = Readonly<{
  total: Money;
  cost: Money;
  profit: number;
}>;

export type PricingError =
  | 'INVALID_QUANTITY'
  | 'INVALID_LABOR_MINUTES'
  | 'INVALID_OVERHEAD'
  | 'INVALID_MARGIN'
  | 'INVALID_ROUNDING_MULTIPLE'
  | 'INVALID_SALE_PRICE'
  | 'INVALID_MINIMUM_PROFIT'
  | 'AMOUNT_OUT_OF_RANGE';

const bpsBase = 10_000n;
const minutesPerHour = 60n;

const isNonNegativeInteger = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

const isPositiveInteger = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

/** Rounds a non-negative fraction half up to an integer. */
const roundHalfUp = (numerator: bigint, denominator: bigint) =>
  (2n * numerator + denominator) / (2n * denominator);

const ceilDivide = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator - 1n) / denominator;

const toMoney = (amount: bigint): Result<Money, PricingError> => {
  const money = Money.fromPesos(Number(amount));

  return money.ok && BigInt(money.value.amount) === amount
    ? money
    : err('AMOUNT_OUT_OF_RANGE');
};

const toSafeNumber = (amount: bigint): Result<number, PricingError> =>
  amount >= BigInt(Number.MIN_SAFE_INTEGER) &&
  amount <= BigInt(Number.MAX_SAFE_INTEGER)
    ? ok(Number(amount))
    : err('AMOUNT_OUT_OF_RANGE');

const sumLines = (lines: readonly CostLine[]): Result<bigint, PricingError> => {
  let total = 0n;

  for (const line of lines) {
    if (!isPositiveInteger(line.quantity)) {
      return err('INVALID_QUANTITY');
    }

    total += BigInt(line.quantity) * BigInt(line.unitCost.amount);
  }

  return ok(total);
};

const collectMoney = <Key extends string>(
  amounts: Record<Key, bigint>,
): Result<Record<Key, Money>, PricingError> => {
  const result = {} as Record<Key, Money>;

  for (const key of Object.keys(amounts) as Key[]) {
    const money = toMoney(amounts[key]);
    if (!money.ok) {
      return money;
    }
    result[key] = money.value;
  }

  return ok(result);
};

export const calculateCost = (
  input: CostInput,
  settings: PricingSettings,
): Result<CostBreakdown, PricingError> => {
  if (!isNonNegativeInteger(input.laborMinutes)) {
    return err('INVALID_LABOR_MINUTES');
  }
  if (!isNonNegativeInteger(settings.overheadBps)) {
    return err('INVALID_OVERHEAD');
  }

  const materials = sumLines(input.materials);
  if (!materials.ok) {
    return materials;
  }
  const components = sumLines(input.components);
  if (!components.ok) {
    return components;
  }

  const labor = roundHalfUp(
    BigInt(input.laborMinutes) * BigInt(settings.hourlyRate.amount),
    minutesPerHour,
  );
  const overhead = roundHalfUp(
    materials.value * BigInt(settings.overheadBps),
    bpsBase,
  );

  return collectMoney({
    materials: materials.value,
    components: components.value,
    labor,
    overhead,
    total: materials.value + components.value + labor + overhead,
  });
};

/**
 * Applies cost / (1 - margin) and rounds up to the configured multiple, so
 * the resulting margin is never below the target margin.
 */
export const calculateSuggestedPrice = (
  totalCost: Money,
  settings: PricingSettings,
): Result<Money, PricingError> => {
  const { marginBps, priceRoundingMultiple } = settings;
  if (!isNonNegativeInteger(marginBps) || BigInt(marginBps) >= bpsBase) {
    return err('INVALID_MARGIN');
  }
  if (!isPositiveInteger(priceRoundingMultiple)) {
    return err('INVALID_ROUNDING_MULTIPLE');
  }

  const multiple = BigInt(priceRoundingMultiple);
  const steps = ceilDivide(
    BigInt(totalCost.amount) * bpsBase,
    (bpsBase - BigInt(marginBps)) * multiple,
  );

  return toMoney(steps * multiple);
};

/**
 * Profit percentage is measured on the sale price. The minimum check uses the
 * exact fraction; `profitBps` is rounded half up for display.
 */
export const evaluateProfit = (
  salePrice: Money,
  totalCost: Money,
  minimumProfitBps: number,
): Result<ProfitEvaluation, PricingError> => {
  if (salePrice.amount === 0) {
    return err('INVALID_SALE_PRICE');
  }
  if (!isNonNegativeInteger(minimumProfitBps)) {
    return err('INVALID_MINIMUM_PROFIT');
  }

  const price = BigInt(salePrice.amount);
  const profit = price - BigInt(totalCost.amount);
  const scaledProfit = profit * bpsBase;
  const magnitudeBps = roundHalfUp(
    scaledProfit < 0n ? -scaledProfit : scaledProfit,
    price,
  );

  const safeProfit = toSafeNumber(profit);
  if (!safeProfit.ok) {
    return safeProfit;
  }

  return ok({
    profit: safeProfit.value,
    profitBps: Number(profit < 0n ? -magnitudeBps : magnitudeBps),
    isBelowMinimum: scaledProfit < BigInt(minimumProfitBps) * price,
  });
};

/** A line total is the already rounded unit price times the quantity. */
export const calculateLine = (
  input: LineInput,
): Result<LineTotal, PricingError> => {
  if (!isPositiveInteger(input.quantity)) {
    return err('INVALID_QUANTITY');
  }

  const quantity = BigInt(input.quantity);
  const total = BigInt(input.unitPrice.amount) * quantity;
  const cost = BigInt(input.unitCost.amount) * quantity;
  const amounts = collectMoney({ total, cost });
  if (!amounts.ok) {
    return amounts;
  }
  const profit = toSafeNumber(total - cost);
  if (!profit.ok) {
    return profit;
  }

  return ok({ ...amounts.value, profit: profit.value });
};
