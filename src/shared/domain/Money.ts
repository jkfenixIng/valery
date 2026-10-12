import { err, ok, type Result } from './Result';

export type MoneyError = 'INVALID_MONEY_AMOUNT';

export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: 'COP',
  ) {}

  static fromPesos(amount: number): Result<Money, MoneyError> {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      return err('INVALID_MONEY_AMOUNT');
    }

    return ok(new Money(amount, 'COP'));
  }
}
