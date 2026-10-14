import { err, ok, type Result } from '../../../shared/domain/Result';

export type QuantityError = 'INVALID_QUANTITY';

/** Exact `numerator / denominator` with a positive denominator. */
export type Fraction = Readonly<{ numerator: bigint; denominator: bigint }>;

const decimalPattern = /^(\d+)[.,](\d+)$/;
const fractionPattern = /^(\d+)\/(\d+)$/;
const mixedNumberPattern = /^(\d+) (\d+)\/(\d+)$/;

const greatestCommonDivisor = (left: bigint, right: bigint): bigint =>
  right === 0n ? left : greatestCommonDivisor(right, left % right);

const isSafe = (value: bigint) => value <= BigInt(Number.MAX_SAFE_INTEGER);

const invalid = () => err('INVALID_QUANTITY' as const);

/**
 * A strictly positive, exact rational quantity (0.250 kg, 1/3, 1 1/2).
 * Always normalized, so equal values have equal parts.
 */
export class Quantity {
  private constructor(
    public readonly numerator: bigint,
    public readonly denominator: bigint,
  ) {}

  private static of(
    numerator: bigint,
    denominator: bigint,
  ): Result<Quantity, QuantityError> {
    if (numerator <= 0n || denominator <= 0n) {
      return invalid();
    }
    if (!isSafe(numerator) || !isSafe(denominator)) {
      return invalid();
    }

    const divisor = greatestCommonDivisor(numerator, denominator);
    return ok(new Quantity(numerator / divisor, denominator / divisor));
  }

  static fromInteger(value: number): Result<Quantity, QuantityError> {
    return Number.isSafeInteger(value) ? Quantity.of(BigInt(value), 1n) : invalid();
  }

  /** Accepts `.` or `,` as decimal separator: `0.250`, `1,5`. */
  static fromDecimal(text: string): Result<Quantity, QuantityError> {
    const match = decimalPattern.exec(text);
    if (!match) {
      return invalid();
    }

    const [, whole, decimals] = match;
    return Quantity.of(BigInt(whole + decimals), 10n ** BigInt(decimals.length));
  }

  static fromFraction(text: string): Result<Quantity, QuantityError> {
    const match = fractionPattern.exec(text);
    return match ? Quantity.of(BigInt(match[1]), BigInt(match[2])) : invalid();
  }

  static fromMixedNumber(text: string): Result<Quantity, QuantityError> {
    const match = mixedNumberPattern.exec(text);
    if (!match) {
      return invalid();
    }

    const fraction = Quantity.fromFraction(`${match[2]}/${match[3]}`);
    if (!fraction.ok) {
      return fraction;
    }
    const { numerator, denominator } = fraction.value;
    return Quantity.of(BigInt(match[1]) * denominator + numerator, denominator);
  }

  static parse(text: string): Result<Quantity, QuantityError> {
    const value = text.trim();
    if (/^\d+$/.test(value)) {
      return Quantity.fromInteger(Number(value));
    }
    if (decimalPattern.test(value)) {
      return Quantity.fromDecimal(value);
    }
    if (fractionPattern.test(value)) {
      return Quantity.fromFraction(value);
    }
    return Quantity.fromMixedNumber(value);
  }

  equals(other: Quantity): boolean {
    return (
      this.numerator === other.numerator &&
      this.denominator === other.denominator
    );
  }

  /** Exact product with an integer COP amount; the caller decides rounding. */
  times(amount: bigint): Fraction {
    return { numerator: this.numerator * amount, denominator: this.denominator };
  }

  toString(): string {
    return `${this.numerator}/${this.denominator}`;
  }
}
