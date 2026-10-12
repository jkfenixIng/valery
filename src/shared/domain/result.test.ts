import { describe, expect, it } from 'vitest';

import { err, ok } from './Result';

describe('Result', () => {
  it('represents a successful value', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('represents an explicit domain error', () => {
    expect(err('INVALID_MONEY_AMOUNT')).toEqual({
      ok: false,
      error: 'INVALID_MONEY_AMOUNT',
    });
  });
});
