import { describe, expect, it } from 'vitest';

import {
  submitPricingSettings,
  type PricingSettingsSubmissionDependencies,
} from './pricing-settings-submission';

const input = {
  hourlyRateCop: '8000',
  marginPercent: '40',
  overheadPercent: '10',
  priceRoundingMultipleCop: '500',
};

const formData = (values = input) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
};

const dependencies = (
  actorUserId: string | null,
  result: Awaited<
    ReturnType<PricingSettingsSubmissionDependencies['updateSettings']>
  >,
): PricingSettingsSubmissionDependencies => ({
  getActorId: async () => actorUserId,
  updateSettings: async () => result,
});

describe('submitPricingSettings', () => {
  it('does not call the update use case without an authorized actor', async () => {
    let called = false;
    const state = await submitPricingSettings(
      {
        getActorId: async () => null,
        updateSettings: async () => {
          called = true;
          return { ok: true };
        },
      },
      formData(),
    );

    expect(state).toEqual({ status: 'error', message: 'No autorizado.' });
    expect(called).toBe(false);
  });

  it('validates empty fields at the Zod action boundary', async () => {
    const state = await submitPricingSettings(
      dependencies('admin-1', { ok: true }),
      formData({ ...input, marginPercent: '' }),
    );

    expect(state).toMatchObject({
      status: 'error',
      fieldErrors: {
        marginPercent:
          'Escribe un porcentaje desde 0 y menor que 100, con hasta dos decimales.',
      },
    });
  });

  it('returns generic unauthorized feedback when the use case rejects the actor', async () => {
    await expect(
      submitPricingSettings(
        dependencies('admin-1', { ok: false, error: { code: 'UNAUTHORIZED' } }),
        formData(),
      ),
    ).resolves.toEqual({ status: 'error', message: 'No autorizado.' });
  });
});
