import { describe, expect, it } from 'vitest';

import { Product, type ProductInput } from './product';

const flour = '11111111-1111-4111-8111-111111111111';
const eggs = '22222222-2222-4222-8222-222222222222';
const wax = '33333333-3333-4333-8333-333333333333';
const lavender = '44444444-4444-4444-8444-444444444444';
const brownie = '55555555-5555-4555-8555-555555555555';
const bag = '66666666-6666-4666-8666-666666666666';

const base: ProductInput = {
  name: ' Torta de chocolate ',
  description: 'Torta húmeda.',
  calculationType: 'recipe',
  baseLaborMinutes: 90,
  ownMarginBps: null,
  recipeYieldPortions: 12,
  fixedPriceCop: null,
  isPublished: false,
  components: [
    { kind: 'supply', referenceId: flour, quantity: '0,250' },
    { kind: 'supply', referenceId: eggs, quantity: '1/3' },
  ],
  optionGroups: [],
};

const fieldsOf = (input: ProductInput) => {
  const result = Product.create(input);
  return result.ok ? [] : result.error.fields;
};

describe('Product', () => {
  it('creates a recipe with exact canonical supply quantities and integer yield', () => {
    const result = Product.create(base);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Torta de chocolate');
    expect(result.value.recipeYieldPortions).toBe(12);
    expect(
      result.value.components.map((component) => component.quantity.toString()),
    ).toEqual(['1/4', '1/3']);
  });

  it('keeps a backfilled legacy 0.333 as 333/1000, never as 1/3', () => {
    const result = Product.create({
      ...base,
      components: [
        { kind: 'supply', referenceId: flour, quantity: '333/1000' },
      ],
    });

    expect(result.ok && result.value.components[0].quantity.toString()).toBe(
      '333/1000',
    );
  });

  it.each([null, 0, 2.5, -1])(
    'rejects recipe yield %p: a recipe needs a positive whole number of portions',
    (recipeYieldPortions) => {
      expect(fieldsOf({ ...base, recipeYieldPortions })).toEqual([
        'recipeYieldPortions',
      ]);
    },
  );

  it.each(['0', '-1', 'abc', '1/0', ''])(
    'rejects component quantity %p',
    (quantity) => {
      expect(
        fieldsOf({
          ...base,
          components: [{ kind: 'supply', referenceId: flour, quantity }],
        }),
      ).toEqual(['components.0.quantity']);
    },
  );

  it('rejects product components, duplicates and option groups in a recipe', () => {
    expect(
      fieldsOf({
        ...base,
        components: [
          { kind: 'product', referenceId: brownie, quantity: '1' },
          { kind: 'supply', referenceId: flour, quantity: '1' },
          { kind: 'supply', referenceId: flour, quantity: '2' },
        ],
        optionGroups: [
          {
            name: 'Sabor',
            selection: 'single',
            required: true,
            visible: true,
            values: [],
          },
        ],
      }),
    ).toEqual([
      'components.0.kind',
      'components.2.referenceId',
      'optionGroups',
    ]);
  });

  it('creates a candle base with extras whose values add cost, minutes and supplies', () => {
    const result = Product.create({
      ...base,
      name: 'Vela personalizada',
      calculationType: 'base_with_extras',
      recipeYieldPortions: null,
      components: [{ kind: 'supply', referenceId: wax, quantity: '200' }],
      optionGroups: [
        {
          name: 'Aroma',
          selection: 'single',
          required: true,
          visible: true,
          values: [
            {
              name: 'Lavanda',
              extraMaterialCostCop: 1500,
              extraLaborMinutes: 5,
              suggestedExtraPriceCop: 4000,
              components: [{ supplyId: lavender, quantity: '0.5' }],
            },
          ],
        },
        {
          name: 'Personalización',
          selection: 'multiple',
          required: false,
          visible: false,
          values: [
            {
              name: 'Nombre',
              extraMaterialCostCop: 0,
              extraLaborMinutes: 15,
              suggestedExtraPriceCop: null,
              components: [],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [aroma] = result.value.optionGroups;
    expect(aroma.values[0].components[0].quantity.toString()).toBe('1/2');
    expect(result.value.optionGroups[1]).toMatchObject({
      selection: 'multiple',
      required: false,
      visible: false,
    });
  });

  it('validates option groups and values with exact paths', () => {
    expect(
      fieldsOf({
        ...base,
        calculationType: 'base_with_extras',
        recipeYieldPortions: null,
        optionGroups: [
          {
            name: ' ',
            selection: 'single',
            required: true,
            visible: true,
            values: [],
          },
          {
            name: 'Color',
            selection: 'single',
            required: false,
            visible: true,
            values: [
              {
                name: 'Rojo',
                extraMaterialCostCop: -1,
                extraLaborMinutes: 1.5,
                suggestedExtraPriceCop: -2,
                components: [{ supplyId: 'x', quantity: '1/3' }],
              },
              {
                name: 'Rojo',
                extraMaterialCostCop: 0,
                extraLaborMinutes: 0,
                suggestedExtraPriceCop: null,
                components: [{ supplyId: wax, quantity: '0' }],
              },
            ],
          },
        ],
      }),
    ).toEqual([
      'optionGroups.0.name',
      'optionGroups.0.values',
      'optionGroups.1.values.0.extraMaterialCostCop',
      'optionGroups.1.values.0.extraLaborMinutes',
      'optionGroups.1.values.0.suggestedExtraPriceCop',
      'optionGroups.1.values.0.components.0.supplyId',
      'optionGroups.1.values.1.name',
      'optionGroups.1.values.1.components.0.quantity',
    ]);
  });

  it('creates a gift-bag bundle mixing supplies and products', () => {
    const result = Product.create({
      ...base,
      name: 'Bolsa de regalo',
      calculationType: 'bundle',
      recipeYieldPortions: null,
      components: [
        { kind: 'supply', referenceId: bag, quantity: '1' },
        { kind: 'product', referenceId: brownie, quantity: '2' },
      ],
    });

    expect(result.ok && result.value.components.map((c) => c.kind)).toEqual([
      'supply',
      'product',
    ]);
  });

  it('requires a manual price and forbids recipe data in a fixed-price product', () => {
    expect(
      fieldsOf({
        ...base,
        calculationType: 'fixed_price',
        fixedPriceCop: null,
      }),
    ).toEqual(['recipeYieldPortions', 'fixedPriceCop', 'components']);

    const fixed = Product.create({
      ...base,
      calculationType: 'fixed_price',
      recipeYieldPortions: null,
      fixedPriceCop: 25000,
      components: [],
    });
    expect(fixed.ok && fixed.value.fixedPriceCop).toBe(25000);
  });

  it('rejects a manual price outside fixed-price products and an own margin of 100%', () => {
    expect(
      fieldsOf({ ...base, fixedPriceCop: 1000, ownMarginBps: 10_000 }),
    ).toEqual(['ownMarginBps', 'fixedPriceCop']);
  });

  it('round-trips details to editable input text with canonical quantities', () => {
    const result = Product.create(base);
    if (!result.ok) throw new Error('Recipe was not created.');

    expect(Product.toInput(result.value).components).toEqual([
      { kind: 'supply', referenceId: flour, quantity: '1/4' },
      { kind: 'supply', referenceId: eggs, quantity: '1/3' },
    ]);
  });
});
