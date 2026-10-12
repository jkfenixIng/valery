import { describe, expect, it } from 'vitest';

import { Money } from './Money';

describe('Money', () => {
  it('creates a COP amount from a non-negative integer number of pesos', () => {
    const result = Money.fromPesos(12_500);

    expect(result).toEqual({ ok: true, value: expect.any(Money) });
    if (result.ok) {
      expect(result.value.amount).toBe(12_500);
      expect(result.value.currency).toBe('COP');
    }
  });

  it.each([-1, 12.5, Number.NaN])('rejects %p as a COP amount', (amount) => {
    expect(Money.fromPesos(amount)).toEqual({
      ok: false,
      error: 'INVALID_MONEY_AMOUNT',
    });
  });
});
