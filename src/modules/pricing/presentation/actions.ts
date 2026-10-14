'use server';

import { headers } from 'next/headers';

import { container } from '@/composition/container';

import {
  submitPricingSettings,
  type PricingSettingsFormState,
} from './pricing-settings-submission';

export const updatePricingSettingsAction = async (
  _: PricingSettingsFormState,
  formData: FormData,
): Promise<PricingSettingsFormState> =>
  submitPricingSettings(
    {
      getActorId: async () => container.auth.getAdminActorId(await headers()),
      updateSettings: container.pricing.updateSettings,
    },
    formData,
  );
