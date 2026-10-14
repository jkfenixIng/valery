import { describe, expect, it } from 'vitest';

import { assertPublicDto, findForbiddenPublicFields } from './public-dto';

describe('public DTO contract', () => {
  it('allows a public DTO without cost, margin, or inventory fields', () => {
    expect(() =>
      assertPublicDto({
        id: 'product-1',
        name: 'Birthday cake',
        salePriceCop: 85000,
        options: [{ name: 'Vanilla', quantity: 2 }],
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
    ).not.toThrow();
  });

  it('rejects sensitive fields nested in objects and arrays with their path', () => {
    expect(() =>
      assertPublicDto({
        items: [{ product: { unitCostCop: 1200 } }],
      }),
    ).toThrow('items[0].product.unitCostCop');
  });

  it('detects schema column names and naming variants', () => {
    expect(
      findForbiddenPublicFields({
        unitCostCop: 1,
        marginBps: 1,
        unit_cost_cop: 1,
        margin_bps: 1,
        totalCost: 1,
        profitCop: 1,
        inventory: [],
        stockLevel: 1,
        quantityOnHand: 1,
      }),
    ).toEqual([
      'unitCostCop',
      'marginBps',
      'unit_cost_cop',
      'margin_bps',
      'totalCost',
      'profitCop',
      'inventory',
      'stockLevel',
      'quantityOnHand',
    ]);
  });
});
