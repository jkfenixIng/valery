'use client';

import { useActionState } from 'react';

import type {
  SupplyCategory,
  SupplyLimits,
  SupplyRecord,
} from '@/composition/container';
import { Field, GlassButton } from '@/shared/ui';

import { createSupplyAction, updateSupplyAction } from './actions';
import type { SupplyFormState } from './supply-submission';

type SupplyFormProps = Readonly<{
  categories: readonly SupplyCategory[];
  limits: SupplyLimits;
  supply?: SupplyRecord;
}>;

const initialState: SupplyFormState = { status: 'idle' };

export function SupplyForm({ categories, limits, supply }: SupplyFormProps) {
  const action = supply
    ? updateSupplyAction.bind(null, supply.id)
    : createSupplyAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = state.values ?? {
    categoryId: supply?.categoryId ?? '',
    name: supply?.name ?? '',
    unit: supply?.unit ?? '',
    unitCostCop: supply?.unitCostCop.toString() ?? '',
  };
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="auth-form" noValidate>
      {supply ? null : (
        <label className="field">
          <span className="field-label">Categoría</span>
          <select
            aria-describedby={
              errors.categoryId ? 'supply-category-error' : undefined
            }
            aria-invalid={Boolean(errors.categoryId) || undefined}
            className="field-input"
            defaultValue={values.categoryId}
            id="supply-category"
            key={`category-${values.categoryId}`}
            name="categoryId"
            required
          >
            <option disabled value="">
              Elige una categoría
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {errors.categoryId ? (
            <span
              className="field-error"
              id="supply-category-error"
              role="alert"
            >
              {errors.categoryId}
            </span>
          ) : null}
        </label>
      )}
      <Field
        defaultValue={values.name}
        error={errors.name}
        id="supply-name"
        key={`name-${values.name}`}
        label={`Nombre del insumo (máximo ${limits.nameMaxLength} caracteres)`}
        maxLength={limits.nameMaxLength}
        name="name"
        required
      />
      <Field
        defaultValue={values.unit}
        error={errors.unit}
        id="supply-unit"
        key={`unit-${values.unit}`}
        label={`Unidad (máximo ${limits.unitMaxLength} caracteres)`}
        maxLength={limits.unitMaxLength}
        name="unit"
        placeholder="g, ml, unidad"
        required
      />
      <Field
        defaultValue={values.unitCostCop}
        error={errors.unitCostCop}
        id="supply-unit-cost"
        inputMode="numeric"
        key={`cost-${values.unitCostCop}`}
        label="Costo por unidad (COP)"
        name="unitCostCop"
        required
      />
      {state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'}>
          {state.message}
        </p>
      ) : null}
      <GlassButton loading={pending} type="submit">
        {supply ? 'Guardar cambios' : 'Crear insumo'}
      </GlassButton>
    </form>
  );
}
