import { describe, expect, it } from 'vitest';

import {
  reviewFormState,
  submitNewProduct,
  submitProductArchive,
  submitProductChanges,
  toProductFormValues,
  type ProductSubmissionDependencies,
} from './product-submission';

const categoryId = '22222222-2222-4222-8222-222222222222';
const productId = '66666666-6666-4666-8666-666666666666';
const wax = '33333333-3333-4333-8333-333333333333';

const candle = {
  categoryId,
  name: 'Vela personalizada',
  description: 'Vela de soya.',
  calculationType: 'base_with_extras',
  baseLaborMinutes: '30',
  ownMarginPercent: '35,5',
  recipeYieldPortions: '',
  fixedPriceCop: '',
  isPublished: 'on',
  componentsJson: JSON.stringify([
    { kind: 'supply', referenceId: wax, quantity: '0.1' },
  ]),
  optionGroupsJson: JSON.stringify([
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
          suggestedExtraPriceCop: null,
          components: [{ supplyId: wax, quantity: '1/3' }],
        },
      ],
    },
  ]),
};

const formData = (entries: Record<string, string>) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
};

const fake = (
  actorUserId: string | null,
  result: Awaited<ReturnType<ProductSubmissionDependencies['create']>> = {
    ok: true,
  },
) => {
  const calls: unknown[][] = [];
  const dependencies: ProductSubmissionDependencies = {
    limits: {
      nameMaxLength: 120,
      descriptionMaxLength: 1000,
      optionNameMaxLength: 80,
      maxLaborMinutes: 100_000,
      maxYieldPortions: 10_000,
    },
    getActorId: async () => actorUserId,
    create: async (...args) => (calls.push(args), result),
    update: async (...args) => (calls.push(args), result),
    archive: async (...args) => (calls.push(args), result),
  };
  return { calls, dependencies };
};

describe('product submissions', () => {
  it('rejects every mutation without a re-checked actor, before any use case', async () => {
    const { calls, dependencies } = fake(null);
    const unauthorized = { status: 'error', message: 'No autorizado.' };

    await expect(
      submitNewProduct(dependencies, formData(candle)),
    ).resolves.toEqual(unauthorized);
    await expect(
      submitProductChanges(dependencies, productId, formData(candle)),
    ).resolves.toEqual(unauthorized);
    await expect(
      submitProductArchive(dependencies, productId),
    ).resolves.toEqual(unauthorized);
    expect(calls).toEqual([]);
  });

  it('passes quantities as untouched text and the margin as exact basis points', async () => {
    const { calls, dependencies } = fake('admin-1');

    await expect(
      submitNewProduct(dependencies, formData(candle)),
    ).resolves.toEqual({ status: 'saved', message: 'Producto creado.' });

    const [[actor, category, input]] = calls as [
      [string, string, Record<string, unknown>],
    ];
    expect([actor, category]).toEqual(['admin-1', categoryId]);
    expect(input).toMatchObject({
      calculationType: 'base_with_extras',
      baseLaborMinutes: 30,
      ownMarginBps: 3550,
      recipeYieldPortions: null,
      fixedPriceCop: null,
      isPublished: true,
      components: [{ kind: 'supply', referenceId: wax, quantity: '0.1' }],
    });
    expect(
      (input.optionGroups as { values: { components: unknown[] }[] }[])[0]
        .values[0].components,
    ).toEqual([{ supplyId: wax, quantity: '1/3' }]);
  });

  it('rejects malformed transport data at the Zod boundary', async () => {
    const { calls, dependencies } = fake('admin-1');

    const state = await submitNewProduct(
      dependencies,
      formData({
        ...candle,
        categoryId: 'x',
        recipeYieldPortions: '2.5',
        ownMarginPercent: '100',
        componentsJson: '[{"kind":"supply","referenceId":"a","quantity":0.5}]',
        optionGroupsJson: 'not json',
      }),
    );

    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual([
      'categoryId',
      'componentsJson',
      'optionGroupsJson',
      'ownMarginPercent',
      'recipeYieldPortions',
    ]);
    expect(calls).toEqual([]);
  });

  it('maps domain paths and store errors to Spanish feedback', async () => {
    const invalid = fake('admin-1', {
      ok: false,
      error: {
        code: 'PRODUCT_INVALID',
        fields: ['components.0.quantity', 'ownMarginBps'],
      },
    });
    const state = await submitProductChanges(
      invalid.dependencies,
      productId,
      formData(candle),
    );
    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual([
      'componentsJson',
      'ownMarginPercent',
    ]);

    const missing = fake('admin-1', {
      ok: false,
      error: { code: 'PRODUCT_NOT_FOUND' },
    });
    await expect(
      submitProductArchive(missing.dependencies, productId),
    ).resolves.toMatchObject({
      status: 'error',
      message: 'El producto no existe o ya fue archivado.',
    });
  });

  it('explains bundle integrity and missing category errors in Spanish', async () => {
    const inUse = fake('admin-1', {
      ok: false,
      error: { code: 'PRODUCT_IN_USE_BY_BUNDLE' },
    });
    await expect(
      submitProductArchive(inUse.dependencies, productId),
    ).resolves.toMatchObject({
      status: 'error',
      message:
        'No se puede archivar: este producto está siendo usado por uno o más combos.',
    });

    const nested = fake('admin-1', {
      ok: false,
      error: { code: 'PRODUCT_USED_AS_BUNDLE_COMPONENT' },
    });
    await expect(
      submitProductChanges(nested.dependencies, productId, formData(candle)),
    ).resolves.toMatchObject({
      status: 'error',
      message:
        'No se puede convertir en combo: este producto está siendo usado como componente de otro combo.',
    });

    const category = fake('admin-1', {
      ok: false,
      error: { code: 'PRODUCT_CATEGORY_NOT_FOUND' },
    });
    await expect(
      submitNewProduct(category.dependencies, formData(candle)),
    ).resolves.toMatchObject({
      status: 'error',
      message: 'La categoría elegida ya no existe.',
    });
  });

  it('flags the fields of a stored product that needs review', () => {
    expect(reviewFormState([])).toEqual({ status: 'idle' });
    expect(
      reviewFormState(['ownMarginBps', 'fixedPriceCop', 'components']),
    ).toEqual({
      status: 'idle',
      fieldErrors: {
        ownMarginPercent: expect.any(String),
        fixedPriceCop: expect.any(String),
        componentsJson: expect.any(String),
      },
    });
  });

  it('renders saved input back to form text with canonical quantities', () => {
    const values = toProductFormValues(categoryId, {
      name: 'Torta',
      description: 'Torta.',
      calculationType: 'recipe',
      baseLaborMinutes: 60,
      ownMarginBps: 3505,
      recipeYieldPortions: 12,
      fixedPriceCop: null,
      isPublished: false,
      components: [{ kind: 'supply', referenceId: wax, quantity: '1/3' }],
      optionGroups: [],
    });

    expect(values).toMatchObject({
      ownMarginPercent: '35,05',
      recipeYieldPortions: '12',
      componentsJson: JSON.stringify([
        { kind: 'supply', referenceId: wax, quantity: '1/3' },
      ]),
    });
  });
});
