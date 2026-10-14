'use client';

import { useActionState } from 'react';

import type { PricingSettingsInput } from '@/composition/container';
import { Field, GlassButton } from '@/shared/ui';

import { updatePricingSettingsAction } from './actions';
import type { PricingSettingsFormState } from './pricing-settings-submission';

const emptyValues: PricingSettingsInput = {
  hourlyRateCop: '',
  marginPercent: '',
  overheadPercent: '',
  priceRoundingMultipleCop: '',
};

export function PricingSettingsForm({
  initialValues,
}: Readonly<{ initialValues: PricingSettingsInput | null }>) {
  const [state, action, pending] = useActionState(updatePricingSettingsAction, {
    status: 'idle',
  } satisfies PricingSettingsFormState);
  const values = state.values ?? initialValues ?? emptyValues;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="auth-form" noValidate>
      <Field
        defaultValue={values.hourlyRateCop}
        error={errors.hourlyRateCop}
        id="hourly-rate-cop"
        inputMode="numeric"
        key={`hourly-${values.hourlyRateCop}`}
        label="Tarifa por hora (COP)"
        name="hourlyRateCop"
        required
      />
      <Field
        defaultValue={values.marginPercent}
        error={errors.marginPercent}
        id="margin-percent"
        inputMode="decimal"
        key={`margin-${values.marginPercent}`}
        label="Margen de ganancia (%)"
        name="marginPercent"
        required
      />
      <Field
        defaultValue={values.overheadPercent}
        error={errors.overheadPercent}
        id="overhead-percent"
        inputMode="decimal"
        key={`overhead-${values.overheadPercent}`}
        label="Costos indirectos (%)"
        name="overheadPercent"
        required
      />
      <Field
        aria-describedby="rounding-help"
        defaultValue={values.priceRoundingMultipleCop}
        error={errors.priceRoundingMultipleCop}
        id="price-rounding-multiple-cop"
        inputMode="numeric"
        key={`rounding-${values.priceRoundingMultipleCop}`}
        label="Redondeo de precios (COP)"
        name="priceRoundingMultipleCop"
        required
      />
      <p id="rounding-help">
        Los precios sugeridos suben al múltiplo indicado, por ejemplo 500.
      </p>
      {state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </p>
      ) : null}
      <GlassButton loading={pending} type="submit">
        Guardar ajustes
      </GlassButton>
    </form>
  );
}
