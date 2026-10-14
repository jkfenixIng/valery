import { z } from 'zod';

import type { PricingSettingsInput } from '@/composition/container';

type Field = keyof PricingSettingsInput;

export type PricingSettingsFormState = Readonly<{
  status: 'idle' | 'saved' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  values?: PricingSettingsInput;
}>;

type UpdateResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error:
        | { readonly code: 'UNAUTHORIZED' | 'PRICING_SETTINGS_NOT_CONFIGURED' }
        | {
            readonly code: 'PRICING_SETTINGS_INVALID';
            readonly fields: readonly string[];
          };
    };

export type PricingSettingsSubmissionDependencies = Readonly<{
  getActorId: () => Promise<string | null>;
  updateSettings: (
    actorUserId: string,
    input: PricingSettingsInput,
  ) => Promise<UpdateResult>;
}>;

const text = z.string().trim().min(1).max(32);
const schema = z.object({
  hourlyRateCop: text,
  marginPercent: text,
  overheadPercent: text,
  priceRoundingMultipleCop: text,
});

export const fieldMessages: Readonly<Record<Field, string>> = {
  hourlyRateCop: 'Escribe un valor entero en pesos, igual o mayor que 0.',
  marginPercent:
    'Escribe un porcentaje desde 0 y menor que 100, con hasta dos decimales.',
  overheadPercent:
    'Escribe un porcentaje igual o mayor que 0, con hasta dos decimales.',
  priceRoundingMultipleCop: 'Escribe un valor entero en pesos, mayor que 0.',
};

const unauthorized: PricingSettingsFormState = {
  status: 'error',
  message: 'No autorizado.',
};

const isField = (name: string): name is Field =>
  Object.hasOwn(schema.shape, name);

const fieldErrors = (fields: readonly string[]) =>
  Object.fromEntries(
    fields.filter(isField).map((field) => [field, fieldMessages[field]]),
  );

const readValues = (formData: FormData): PricingSettingsInput => {
  const read = (name: Field) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  return {
    hourlyRateCop: read('hourlyRateCop'),
    marginPercent: read('marginPercent'),
    overheadPercent: read('overheadPercent'),
    priceRoundingMultipleCop: read('priceRoundingMultipleCop'),
  };
};

/** Every write re-checks the admin actor; layout protection is not enough. */
export const submitPricingSettings = async (
  dependencies: PricingSettingsSubmissionDependencies,
  formData: FormData,
): Promise<PricingSettingsFormState> => {
  const actorUserId = await dependencies.getActorId();
  if (!actorUserId) return unauthorized;

  const values = readValues(formData);
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: fieldErrors(
        parsed.error.issues.map((issue) => String(issue.path[0])),
      ),
      values,
    };
  }

  const result = await dependencies.updateSettings(actorUserId, parsed.data);
  if (result.ok) {
    return { status: 'saved', message: 'Ajustes guardados.', values };
  }
  if (result.error.code === 'PRICING_SETTINGS_INVALID') {
    return {
      status: 'error',
      fieldErrors: fieldErrors(result.error.fields),
      values,
    };
  }
  return unauthorized;
};
