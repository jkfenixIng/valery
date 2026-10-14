'use client';

import { useActionState, useState } from 'react';

import type {
  BundleProductOption,
  EditableProduct,
  ProductCategory,
  ProductInput,
  ProductLimits,
  ProductSupplyOption,
} from '@/composition/container';
import { Field, GlassButton } from '@/shared/ui';

import { createProductAction, updateProductAction } from './actions';
import {
  emptyProductValues,
  reviewFormState,
  toProductFormValues,
  type ProductFormState,
  type ProductFormValues,
} from './product-submission';

type Component = ProductInput['components'][number];
type OptionGroup = ProductInput['optionGroups'][number];
type OptionValue = OptionGroup['values'][number];

type ProductFormProps = Readonly<{
  categories: readonly ProductCategory[];
  supplies: readonly ProductSupplyOption[];
  bundleProducts: readonly BundleProductOption[];
  limits: ProductLimits;
  product?: EditableProduct;
}>;

const typeLabels = {
  recipe: 'Receta (rinde porciones)',
  base_with_extras: 'Base con extras',
  bundle: 'Combo (insumos y productos)',
  fixed_price: 'Precio fijo',
} as const;

const quantityHelp = 'Cantidad: 0,25 · 1/3 · 1 1/2';

const parseJson = <T,>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const integer = (text: string) => (/^\d+$/.test(text) ? Number(text) : -1);

const newValue = (): OptionValue => ({
  name: '',
  extraMaterialCostCop: 0,
  extraLaborMinutes: 0,
  suggestedExtraPriceCop: null,
  components: [],
});

const newGroup = (): OptionGroup => ({
  name: '',
  selection: 'single',
  required: false,
  visible: true,
  values: [newValue()],
});

const replaceAt = <T,>(items: readonly T[], index: number, item: T) =>
  items.map((current, position) => (position === index ? item : current));

const removeAt = <T,>(items: readonly T[], index: number) =>
  items.filter((_, position) => position !== index);

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  error,
}: Readonly<{
  label: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { id: string; name: string }[];
  error?: string;
}>) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select
        aria-invalid={Boolean(error) || undefined}
        className="field-input"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option disabled value="">
          Elige una opción
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      {error ? (
        <span className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

function ComponentRows({
  rows,
  onChange,
  supplies,
  products,
  allowProducts,
}: Readonly<{
  rows: readonly Component[];
  onChange: (rows: readonly Component[]) => void;
  supplies: readonly ProductSupplyOption[];
  products: readonly BundleProductOption[];
  allowProducts: boolean;
}>) {
  const supplyOptions = supplies.map((supply) => ({
    id: supply.id,
    name: `${supply.name} (${supply.unit})`,
  }));

  return (
    <fieldset className="auth-form">
      <legend>Componentes</legend>
      {rows.map((row, index) => (
        <div className="auth-form" key={index}>
          {allowProducts ? (
            <SelectField
              label="Tipo de componente"
              onChange={(kind) =>
                onChange(
                  replaceAt(rows, index, {
                    ...row,
                    kind: kind as Component['kind'],
                    referenceId: '',
                  }),
                )
              }
              options={[
                { id: 'supply', name: 'Insumo' },
                { id: 'product', name: 'Producto' },
              ]}
              value={row.kind}
            />
          ) : null}
          <SelectField
            label={row.kind === 'supply' ? 'Insumo' : 'Producto'}
            onChange={(referenceId) =>
              onChange(replaceAt(rows, index, { ...row, referenceId }))
            }
            options={row.kind === 'supply' ? supplyOptions : products}
            value={row.referenceId}
          />
          <Field
            inputMode="decimal"
            label={quantityHelp}
            onChange={(event) =>
              onChange(
                replaceAt(rows, index, {
                  ...row,
                  quantity: event.target.value,
                }),
              )
            }
            value={row.quantity}
          />
          <GlassButton
            onClick={() => onChange(removeAt(rows, index))}
            type="button"
            variant="ghost"
          >
            Quitar componente
          </GlassButton>
        </div>
      ))}
      <GlassButton
        onClick={() =>
          onChange([...rows, { kind: 'supply', referenceId: '', quantity: '' }])
        }
        type="button"
        variant="secondary"
      >
        Agregar componente
      </GlassButton>
    </fieldset>
  );
}

function OptionValueEditor({
  value,
  onChange,
  onRemove,
  supplies,
}: Readonly<{
  value: OptionValue;
  onChange: (value: OptionValue) => void;
  onRemove: () => void;
  supplies: readonly ProductSupplyOption[];
}>) {
  const supplyRows: Component[] = value.components.map((component) => ({
    kind: 'supply',
    referenceId: component.supplyId,
    quantity: component.quantity,
  }));

  return (
    <div className="auth-form">
      <Field
        label="Nombre del valor"
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        value={value.name}
      />
      <Field
        inputMode="numeric"
        label="Costo extra de materiales (COP)"
        onChange={(event) =>
          onChange({
            ...value,
            extraMaterialCostCop: integer(event.target.value),
          })
        }
        value={
          value.extraMaterialCostCop < 0
            ? ''
            : String(value.extraMaterialCostCop)
        }
      />
      <Field
        inputMode="numeric"
        label="Minutos extra de trabajo"
        onChange={(event) =>
          onChange({ ...value, extraLaborMinutes: integer(event.target.value) })
        }
        value={
          value.extraLaborMinutes < 0 ? '' : String(value.extraLaborMinutes)
        }
      />
      <Field
        inputMode="numeric"
        label="Precio extra sugerido (COP, opcional)"
        onChange={(event) =>
          onChange({
            ...value,
            suggestedExtraPriceCop:
              event.target.value.trim() === ''
                ? null
                : integer(event.target.value),
          })
        }
        value={
          value.suggestedExtraPriceCop === null ||
          value.suggestedExtraPriceCop < 0
            ? ''
            : String(value.suggestedExtraPriceCop)
        }
      />
      <ComponentRows
        allowProducts={false}
        onChange={(rows) =>
          onChange({
            ...value,
            components: rows.map((row) => ({
              supplyId: row.referenceId,
              quantity: row.quantity,
            })),
          })
        }
        products={[]}
        rows={supplyRows}
        supplies={supplies}
      />
      <GlassButton onClick={onRemove} type="button" variant="ghost">
        Quitar valor
      </GlassButton>
    </div>
  );
}

function OptionGroupsEditor({
  groups,
  onChange,
  supplies,
}: Readonly<{
  groups: readonly OptionGroup[];
  onChange: (groups: readonly OptionGroup[]) => void;
  supplies: readonly ProductSupplyOption[];
}>) {
  return (
    <fieldset className="auth-form">
      <legend>Grupos de opciones (extras)</legend>
      {groups.map((group, index) => {
        const update = (next: OptionGroup) =>
          onChange(replaceAt(groups, index, next));
        return (
          <fieldset className="auth-form" key={index}>
            <legend>{group.name || `Grupo ${index + 1}`}</legend>
            <Field
              label="Nombre del grupo (Tamaño, Aroma…)"
              onChange={(event) =>
                update({ ...group, name: event.target.value })
              }
              value={group.name}
            />
            <SelectField
              label="Selección"
              onChange={(selection) =>
                update({
                  ...group,
                  selection: selection as OptionGroup['selection'],
                })
              }
              options={[
                { id: 'single', name: 'Única' },
                { id: 'multiple', name: 'Múltiple' },
              ]}
              value={group.selection}
            />
            <label>
              <input
                checked={group.required}
                onChange={(event) =>
                  update({ ...group, required: event.target.checked })
                }
                type="checkbox"
              />{' '}
              Obligatorio
            </label>
            <label>
              <input
                checked={group.visible}
                onChange={(event) =>
                  update({ ...group, visible: event.target.checked })
                }
                type="checkbox"
              />{' '}
              Visible para el cliente
            </label>
            {group.values.map((value, valueIndex) => (
              <OptionValueEditor
                key={valueIndex}
                onChange={(next) =>
                  update({
                    ...group,
                    values: replaceAt(group.values, valueIndex, next),
                  })
                }
                onRemove={() =>
                  update({
                    ...group,
                    values: removeAt(group.values, valueIndex),
                  })
                }
                supplies={supplies}
                value={value}
              />
            ))}
            <GlassButton
              onClick={() =>
                update({ ...group, values: [...group.values, newValue()] })
              }
              type="button"
              variant="secondary"
            >
              Agregar valor
            </GlassButton>
            <GlassButton
              onClick={() => onChange(removeAt(groups, index))}
              type="button"
              variant="ghost"
            >
              Quitar grupo
            </GlassButton>
          </fieldset>
        );
      })}
      <GlassButton
        onClick={() => onChange([...groups, newGroup()])}
        type="button"
        variant="secondary"
      >
        Agregar grupo de opciones
      </GlassButton>
    </fieldset>
  );
}

const startingValues = (product?: EditableProduct): ProductFormValues =>
  product
    ? toProductFormValues(product.categoryId, product.input)
    : emptyProductValues;

export function ProductForm(props: ProductFormProps) {
  const { product } = props;
  const action = product
    ? updateProductAction.bind(null, product.id)
    : createProductAction;
  const [state, formAction, pending] = useActionState(
    action,
    reviewFormState(product?.validationIssues ?? []),
  );
  const values = state.values ?? startingValues(product);

  // Remount the editor on each server round trip so it reflects submitted values.
  return (
    <ProductEditor
      {...props}
      errors={state.fieldErrors ?? {}}
      formAction={formAction}
      key={JSON.stringify(values)}
      message={state.message}
      pending={pending}
      status={state.status}
      values={values}
    />
  );
}

function ProductEditor({
  categories,
  supplies,
  bundleProducts,
  limits,
  product,
  values,
  errors,
  formAction,
  pending,
  message,
  status,
}: ProductFormProps &
  Readonly<{
    values: ProductFormValues;
    errors: Partial<Record<keyof ProductFormValues, string>>;
    formAction: (formData: FormData) => void;
    pending: boolean;
    message?: string;
    status: ProductFormState['status'];
  }>) {
  const [calculationType, setCalculationType] = useState(
    values.calculationType,
  );
  const [categoryId, setCategoryId] = useState(values.categoryId);
  const [components, setComponents] = useState<readonly Component[]>(
    parseJson(values.componentsJson, []),
  );
  const [groups, setGroups] = useState<readonly OptionGroup[]>(
    parseJson(values.optionGroupsJson, []),
  );
  const eligibleProducts = bundleProducts.filter(
    (candidate) => candidate.id !== product?.id,
  );

  const isRecipe = calculationType === 'recipe';
  const isFixed = calculationType === 'fixed_price';
  const hasExtras = calculationType === 'base_with_extras';
  const isBundle = calculationType === 'bundle';

  return (
    <form action={formAction} className="auth-form" noValidate>
      {product && product.validationIssues.length > 0 ? (
        <p role="alert">
          Este producto tiene datos anteriores que no cumplen las reglas
          actuales. Corrige los campos señalados y guarda los cambios para
          actualizarlo.
        </p>
      ) : null}
      <SelectField
        error={errors.categoryId}
        label="Categoría"
        name="categoryId"
        onChange={setCategoryId}
        options={categories}
        value={categoryId}
      />
      <Field
        defaultValue={values.name}
        error={errors.name}
        id="product-name"
        label={`Nombre (máximo ${limits.nameMaxLength} caracteres)`}
        maxLength={limits.nameMaxLength}
        name="name"
        required
      />
      <Field
        defaultValue={values.description}
        error={errors.description}
        id="product-description"
        label="Descripción"
        maxLength={limits.descriptionMaxLength}
        name="description"
        required
      />
      <SelectField
        error={errors.calculationType}
        label="Tipo de cálculo"
        name="calculationType"
        onChange={setCalculationType}
        options={Object.entries(typeLabels).map(([id, name]) => ({ id, name }))}
        value={calculationType}
      />
      <Field
        defaultValue={values.baseLaborMinutes}
        error={errors.baseLaborMinutes}
        id="product-labor"
        inputMode="numeric"
        label="Minutos de trabajo base"
        name="baseLaborMinutes"
      />
      <Field
        defaultValue={values.ownMarginPercent}
        error={errors.ownMarginPercent}
        id="product-margin"
        inputMode="decimal"
        label="Margen propio (%, opcional; vacío usa el de Ajustes)"
        name="ownMarginPercent"
      />
      {isRecipe ? (
        <Field
          defaultValue={values.recipeYieldPortions}
          error={errors.recipeYieldPortions}
          id="product-yield"
          inputMode="numeric"
          label="Rinde (porciones enteras)"
          name="recipeYieldPortions"
          required
        />
      ) : null}
      {isFixed ? (
        <Field
          defaultValue={values.fixedPriceCop}
          error={errors.fixedPriceCop}
          id="product-fixed-price"
          inputMode="numeric"
          label="Precio fijo (COP)"
          name="fixedPriceCop"
          required
        />
      ) : null}
      {isFixed ? null : (
        <ComponentRows
          allowProducts={isBundle}
          onChange={setComponents}
          products={eligibleProducts}
          rows={components}
          supplies={supplies}
        />
      )}
      {errors.componentsJson ? (
        <p className="field-error" role="alert">
          {errors.componentsJson}
        </p>
      ) : null}
      {hasExtras ? (
        <OptionGroupsEditor
          groups={groups}
          onChange={setGroups}
          supplies={supplies}
        />
      ) : null}
      {errors.optionGroupsJson ? (
        <p className="field-error" role="alert">
          {errors.optionGroupsJson}
        </p>
      ) : null}
      <label>
        <input
          defaultChecked={values.isPublished}
          name="isPublished"
          type="checkbox"
        />{' '}
        Publicado (solo se guarda; el catálogo público aún no existe)
      </label>
      <input
        name="componentsJson"
        type="hidden"
        value={JSON.stringify(isFixed ? [] : components)}
      />
      <input
        name="optionGroupsJson"
        type="hidden"
        value={JSON.stringify(hasExtras ? groups : [])}
      />
      {message ? (
        <p role={status === 'error' ? 'alert' : 'status'}>{message}</p>
      ) : null}
      <GlassButton loading={pending} type="submit">
        {product ? 'Guardar cambios' : 'Crear producto'}
      </GlassButton>
    </form>
  );
}
