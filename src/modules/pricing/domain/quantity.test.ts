import { describe, expect, it } from 'vitest';

import { Quantity } from './quantity';

const unwrap = <Value>(
  result: { ok: true; value: Value } | { ok: false; error: unknown },
) => {
  if (!result.ok) {
    throw new Error(`Unexpected error: ${String(result.error)}`);
  }

  return result.value;
};

describe('Quantity', () => {
  it.each([
    ['1,5', '3/2'],
    ['1.5', '3/2'],
    ['1/3', '1/3'],
    ['1 1/2', '3/2'],
  ])('parses %s', (input, expected) => {
    expect(unwrap(Quantity.parse(input)).toString()).toBe(expected);
  });

  it.each(['0', '-1', '1/0', 'abc', '1//2', '9007199254740993/2'])(
    'rejects %s',
    (input) => {
      expect(Quantity.parse(input)).toEqual({
        ok: false,
        error: 'INVALID_QUANTITY',
      });
    },
  );

  it('rejects a non-safe integer', () => {
    expect(Quantity.fromInteger(1.5).ok).toBe(false);
  });

  it('normalizes equivalent fractions', () => {
    expect(
      unwrap(Quantity.fromFraction('2/4')).equals(
        unwrap(Quantity.fromFraction('1/2')),
      ),
    ).toBe(true);
  });
});
