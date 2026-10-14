import { describe, expect, it } from 'vitest';

import {
  submitNewSupply,
  submitSupplyArchive,
  submitSupplyChanges,
  type SupplySubmissionDependencies,
} from './supply-submission';

const categoryId = '22222222-2222-4222-8222-222222222222';
const supplyId = '44444444-4444-4444-8444-444444444444';
const values = { categoryId, name: 'Harina', unit: 'g', unitCostCop: '12' };

const formData = (entries: Record<string, string> = values) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(entries)) form.set(key, value);
  return form;
};

type Calls = { create: unknown[][]; update: unknown[][]; archive: unknown[][] };

const fake = (
  actorUserId: string | null,
  result: Awaited<ReturnType<SupplySubmissionDependencies['create']>> = {
    ok: true,
  },
) => {
  const calls: Calls = { create: [], update: [], archive: [] };
  const dependencies: SupplySubmissionDependencies = {
    limits: { nameMaxLength: 120, unitMaxLength: 32 },
    getActorId: async () => actorUserId,
    create: async (...args) => (calls.create.push(args), result),
    update: async (...args) => (calls.update.push(args), result),
    archive: async (...args) => (calls.archive.push(args), result),
  };
  return { calls, dependencies };
};

describe('supply submissions', () => {
  it('rejects every mutation without an authorized actor, before any use case', async () => {
    const { calls, dependencies } = fake(null);
    const unauthorized = { status: 'error', message: 'No autorizado.' };

    await expect(submitNewSupply(dependencies, formData())).resolves.toEqual(
      unauthorized,
    );
    await expect(
      submitSupplyChanges(dependencies, supplyId, formData()),
    ).resolves.toEqual(unauthorized);
    await expect(submitSupplyArchive(dependencies, supplyId)).resolves.toEqual(
      unauthorized,
    );
    expect(calls).toEqual({ create: [], update: [], archive: [] });
  });

  it('passes the re-checked actor and parsed whole-peso cost to the use case', async () => {
    const { calls, dependencies } = fake('admin-1');

    await expect(
      submitNewSupply(dependencies, formData({ ...values, name: ' Harina ' })),
    ).resolves.toEqual({ status: 'saved', message: 'Insumo creado.' });
    expect(calls.create).toEqual([
      ['admin-1', categoryId, { name: 'Harina', unit: 'g', unitCostCop: 12 }],
    ]);
  });

  it('validates untrusted form data at the Zod boundary without calling the use case', async () => {
    const { calls, dependencies } = fake('admin-1');

    const state = await submitNewSupply(
      dependencies,
      formData({
        categoryId: 'x',
        name: 'a'.repeat(121),
        unit: 'u'.repeat(33),
        unitCostCop: '1.5',
      }),
    );

    expect(Object.keys(state.fieldErrors ?? {}).sort()).toEqual([
      'categoryId',
      'name',
      'unit',
      'unitCostCop',
    ]);
    expect(calls.create).toEqual([]);
  });

  it('maps domain and state errors to Spanish feedback', async () => {
    const taken = fake('admin-1', {
      ok: false,
      error: { code: 'SUPPLY_NAME_TAKEN' },
    });
    await expect(
      submitNewSupply(taken.dependencies, formData()),
    ).resolves.toMatchObject({ status: 'error', values });

    const missing = fake('admin-1', {
      ok: false,
      error: { code: 'SUPPLY_NOT_FOUND' },
    });
    await expect(
      submitSupplyArchive(missing.dependencies, supplyId),
    ).resolves.toMatchObject({
      status: 'error',
      message: 'El insumo no existe o ya fue archivado.',
    });

    const invalid = fake('admin-1', {
      ok: false,
      error: { code: 'SUPPLY_INVALID', fields: ['unit'] },
    });
    await expect(
      submitSupplyChanges(invalid.dependencies, supplyId, formData()),
    ).resolves.toMatchObject({
      status: 'error',
      fieldErrors: { unit: expect.any(String) },
    });
  });
});
