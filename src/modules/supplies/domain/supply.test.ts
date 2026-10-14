import { describe, expect, it } from 'vitest';

import { Supply } from './supply';

describe('Supply.create', () => {
  it.each([
    ['empty name', { name: ' ', unit: 'g', unitCostCop: 1 }, ['name']],
    [
      'long name',
      { name: 'a'.repeat(121), unit: 'g', unitCostCop: 1 },
      ['name'],
    ],
    ['empty unit', { name: 'Harina', unit: ' ', unitCostCop: 1 }, ['unit']],
    [
      'long unit',
      { name: 'Harina', unit: 'u'.repeat(33), unitCostCop: 1 },
      ['unit'],
    ],
    [
      'negative cost',
      { name: 'Harina', unit: 'g', unitCostCop: -1 },
      ['unitCostCop'],
    ],
    [
      'decimal cost',
      { name: 'Harina', unit: 'g', unitCostCop: 1.5 },
      ['unitCostCop'],
    ],
  ])('rejects %s', (_, input, fields) => {
    expect(Supply.create(input)).toEqual({
      ok: false,
      error: { code: 'SUPPLY_INVALID', fields },
    });
  });

  it('trims valid values', () => {
    expect(
      Supply.create({ name: ' Harina ', unit: ' g ', unitCostCop: 2_500 }),
    ).toEqual({
      ok: true,
      value: { name: 'Harina', unit: 'g', unitCostCop: 2_500 },
    });
  });
});
