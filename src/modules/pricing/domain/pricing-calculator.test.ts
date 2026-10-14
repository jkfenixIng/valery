import { describe, expect, it } from 'vitest';

import { Money } from '../../../shared/domain/Money';
import {
  calculateCost,
  calculateLine,
  calculateSuggestedPrice,
  evaluateProfit,
  type CostInput,
  type PricingSettings,
} from './pricing-calculator';

const pesos = (amount: number) => {
  const result = Money.fromPesos(amount);

  if (!result.ok) {
    throw new Error(`Invalid test money: ${amount}`);
  }

  return result.value;
};

const unwrap = <Value>(
  result: { ok: true; value: Value } | { ok: false; error: unknown },
) => {
  if (!result.ok) {
    throw new Error(`Unexpected error: ${String(result.error)}`);
  }

  return result.value;
};

// PRD section 17 sample parameters; they are test data, not Valery's defaults.
const settings: PricingSettings = {
  hourlyRate: pesos(8_000),
  overheadBps: 1_000,
  marginBps: 4_000,
  priceRoundingMultiple: 500,
};
const minimumProfitBps = 1_500;

const price = (input: CostInput) => {
  const cost = unwrap(calculateCost(input, settings));
  const suggestedPrice = unwrap(calculateSuggestedPrice(cost.total, settings));
  const profit = unwrap(
    evaluateProfit(suggestedPrice, cost.total, minimumProfitBps),
  );

  return { cost, suggestedPrice, profit };
};

const caseA: CostInput = {
  materials: [{ quantity: 1, unitCost: pesos(20_000) }],
  components: [],
  laborMinutes: 90,
};

describe('pricing golden cases (PRD section 17)', () => {
  it('A. Torta', () => {
    const result = price(caseA);

    expect(result.cost.labor).toEqual(pesos(12_000));
    expect(result.cost.overhead).toEqual(pesos(2_000));
    expect(result.cost.total).toEqual(pesos(34_000));
    expect(result.suggestedPrice).toEqual(pesos(57_000));
    expect(result.profit).toEqual({
      profit: 23_000,
      profitBps: 4_035,
      isBelowMinimum: false,
    });
  });

  it('B. Vela personalizada', () => {
    const result = price({
      materials: [
        { quantity: 1, unitCost: pesos(9_000) },
        { quantity: 1, unitCost: pesos(1_500) },
        { quantity: 1, unitCost: pesos(2_500) },
      ],
      components: [],
      laborMinutes: 30 + 40,
    });

    expect(result.cost.materials).toEqual(pesos(13_000));
    expect(result.cost.labor).toEqual(pesos(9_333));
    expect(result.cost.overhead).toEqual(pesos(1_300));
    expect(result.cost.total).toEqual(pesos(23_633));
    expect(result.suggestedPrice).toEqual(pesos(39_500));
    expect(result.profit).toEqual({
      profit: 15_867,
      profitBps: 4_017,
      isBelowMinimum: false,
    });
  });

  it('C. Bolsa de regalo con vela', () => {
    const result = price({
      materials: [{ quantity: 1, unitCost: pesos(4_000) }],
      components: [{ quantity: 1, unitCost: pesos(15_000) }],
      laborMinutes: 20,
    });

    expect(result.cost.labor).toEqual(pesos(2_667));
    expect(result.cost.overhead).toEqual(pesos(400));
    expect(result.cost.total).toEqual(pesos(22_067));
    expect(result.suggestedPrice).toEqual(pesos(37_000));
    expect(result.profit).toEqual({
      profit: 14_933,
      profitBps: 4_036,
      isBelowMinimum: false,
    });
  });

  it('D. Tres tortas', () => {
    const unit = price(caseA);

    expect(
      unwrap(
        calculateLine({
          unitPrice: unit.suggestedPrice,
          unitCost: unit.cost.total,
          quantity: 3,
        }),
      ),
    ).toEqual({ total: pesos(171_000), cost: pesos(102_000), profit: 69_000 });
  });
});

describe('calculateCost', () => {
  it('multiplies material quantity by unit cost', () => {
    const cost = unwrap(
      calculateCost(
        {
          materials: [{ quantity: 3, unitCost: pesos(700) }],
          components: [],
          laborMinutes: 0,
        },
        settings,
      ),
    );

    expect(cost.materials).toEqual(pesos(2_100));
  });

  it('rounds labor and overhead half up to whole pesos', () => {
    const cost = unwrap(
      calculateCost(
        {
          materials: [{ quantity: 1, unitCost: pesos(5) }],
          components: [],
          laborMinutes: 30,
        },
        {
          ...settings,
          hourlyRate: pesos(1),
          overheadBps: 1_000,
        },
      ),
    );

    expect(cost.labor).toEqual(pesos(1));
    expect(cost.overhead).toEqual(pesos(1));
  });

  it('applies overhead only to own materials, not included products', () => {
    const cost = unwrap(
      calculateCost(
        {
          materials: [],
          components: [{ quantity: 2, unitCost: pesos(15_000) }],
          laborMinutes: 0,
        },
        settings,
      ),
    );

    expect(cost.components).toEqual(pesos(30_000));
    expect(cost.overhead).toEqual(pesos(0));
    expect(cost.total).toEqual(pesos(30_000));
  });

  it.each([
    ['zero quantity', { quantity: 0 }],
    ['fractional quantity', { quantity: 1.5 }],
  ])('rejects a material line with %s', (_scenario, line) => {
    expect(
      calculateCost(
        {
          materials: [{ unitCost: pesos(1), ...line }],
          components: [],
          laborMinutes: 0,
        },
        settings,
      ),
    ).toEqual({ ok: false, error: 'INVALID_QUANTITY' });
  });

  it.each([-1, 1.5])('rejects %p labor minutes', (laborMinutes) => {
    expect(
      calculateCost({ materials: [], components: [], laborMinutes }, settings),
    ).toEqual({ ok: false, error: 'INVALID_LABOR_MINUTES' });
  });

  it.each([-1, 0.5])('rejects %p overhead basis points', (overheadBps) => {
    expect(calculateCost(caseA, { ...settings, overheadBps })).toEqual({
      ok: false,
      error: 'INVALID_OVERHEAD',
    });
  });
});

describe('calculateSuggestedPrice', () => {
  it('rounds up to the configured multiple without lowering the margin', () => {
    expect(calculateSuggestedPrice(pesos(60_000), settings)).toEqual({
      ok: true,
      value: pesos(100_000),
    });
    expect(calculateSuggestedPrice(pesos(60_001), settings)).toEqual({
      ok: true,
      value: pesos(100_500),
    });
  });

  it.each([-1, 10_000, 4_000.5])(
    'rejects %p margin basis points',
    (marginBps) => {
      expect(
        calculateSuggestedPrice(pesos(34_000), { ...settings, marginBps }),
      ).toEqual({ ok: false, error: 'INVALID_MARGIN' });
    },
  );

  it.each([0, -500, 2.5])('rejects %p as rounding multiple', (multiple) => {
    expect(
      calculateSuggestedPrice(pesos(34_000), {
        ...settings,
        priceRoundingMultiple: multiple,
      }),
    ).toEqual({ ok: false, error: 'INVALID_ROUNDING_MULTIPLE' });
  });
});

describe('evaluateProfit', () => {
  it('warns when a manual price leaves profit below the minimum', () => {
    expect(
      evaluateProfit(pesos(40_000), pesos(34_000), minimumProfitBps),
    ).toEqual({
      ok: true,
      value: { profit: 6_000, profitBps: 1_500, isBelowMinimum: false },
    });
    expect(
      evaluateProfit(pesos(39_999), pesos(34_000), minimumProfitBps),
    ).toEqual({
      ok: true,
      value: { profit: 5_999, profitBps: 1_500, isBelowMinimum: true },
    });
  });

  it('reports a loss as negative profit', () => {
    expect(
      evaluateProfit(pesos(30_000), pesos(34_000), minimumProfitBps),
    ).toEqual({
      ok: true,
      value: { profit: -4_000, profitBps: -1_333, isBelowMinimum: true },
    });
  });

  it('rejects a zero sale price', () => {
    expect(evaluateProfit(pesos(0), pesos(34_000), minimumProfitBps)).toEqual({
      ok: false,
      error: 'INVALID_SALE_PRICE',
    });
  });
});

describe('calculateLine', () => {
  it.each([0, -1, 1.5])('rejects %p as a line quantity', (quantity) => {
    expect(
      calculateLine({ unitPrice: pesos(500), unitCost: pesos(100), quantity }),
    ).toEqual({ ok: false, error: 'INVALID_QUANTITY' });
  });

  it('rejects a total beyond the safe COP integer range', () => {
    expect(
      calculateLine({
        unitPrice: pesos(Number.MAX_SAFE_INTEGER),
        unitCost: pesos(0),
        quantity: 2,
      }),
    ).toEqual({ ok: false, error: 'AMOUNT_OUT_OF_RANGE' });
  });
});
