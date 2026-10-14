import { Money } from '../../../shared/domain/Money';
import { err, ok, type Result } from '../../../shared/domain/Result';
import type { Fraction, Quantity } from './quantity';

/** Percentages are integer basis points: 40% = 4000. */
export type PricingSettings = Readonly<{
  hourlyRate: Money;
  overheadBps: number;
  marginBps: number;
  priceRoundingMultiple: number;
}>;

export type CostLine = Readonly<{
  quantity: Quantity;
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
  quantity: Quantity;
}>;

export type LineTotal = Readonly<{
  total: Money;
  cost: Money;
  profit: number;
}>;

export type PricingError =
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

const addFractions = (left: Fraction, right: Fraction): Fraction => ({
  numerator:
    left.numerator * right.denominator + right.numerator * left.denominator,
  denominator: left.denominator * right.denominator,
});

const sumLines = (lines: readonly CostLine[]): Fraction => {
  let total: Fraction = { numerator: 0n, denominator: 1n };

  for (const line of lines) {
    total = addFractions(total, line.quantity.times(BigInt(line.unitCost.amount)));
  }

  return total;
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

/**
 * Rounding policy (the PRD is silent on fractional quantities): material and
 * component lines are summed as exact rationals, and each category total is
 * rounded half up to COP once. Rounding per line would bias sums such as
 * three lines of 1/3 x 10 (10, not 9). Overhead uses the rounded materials.
 */
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
  const components = sumLines(input.components);
  const roundedMaterials = roundHalfUp(materials.numerator, materials.denominator);
  const roundedComponents = roundHalfUp(components.numerator, components.denominator);

  const labor = roundHalfUp(
    BigInt(input.laborMinutes) * BigInt(settings.hourlyRate.amount),
    minutesPerHour,
  );
  const overhead = roundHalfUp(
    roundedMaterials * BigInt(settings.overheadBps),
    bpsBase,
  );

  return collectMoney({
    materials: roundedMaterials,
    components: roundedComponents,
    labor,
    overhead,
    total: roundedMaterials + roundedComponents + labor + overhead,
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

/**
 * A line total is the already rounded unit price times the exact quantity,
 * rounded half up to COP; the line cost is computed the same way.
 */
export const calculateLine = (
  input: LineInput,
): Result<LineTotal, PricingError> => {
  const price = input.quantity.times(BigInt(input.unitPrice.amount));
  const unitCost = input.quantity.times(BigInt(input.unitCost.amount));
  const total = roundHalfUp(price.numerator, price.denominator);
  const cost = roundHalfUp(unitCost.numerator, unitCost.denominator);
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
