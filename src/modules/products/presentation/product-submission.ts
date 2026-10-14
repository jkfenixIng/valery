import { z } from 'zod';

import type {
  ProductInput,
  ProductLimits,
  ProductMutationError,
} from '@/composition/container';

/** Raw form text; component trees travel as JSON with quantities as text. */
export type ProductFormValues = Readonly<{
  categoryId: string;
  name: string;
  description: string;
  calculationType: string;
  baseLaborMinutes: string;
  ownMarginPercent: string;
  recipeYieldPortions: string;
  fixedPriceCop: string;
  isPublished: boolean;
  componentsJson: string;
  optionGroupsJson: string;
}>;

type Field = keyof ProductFormValues;

export type ProductFormState = Readonly<{
  status: 'idle' | 'saved' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  values?: ProductFormValues;
}>;

type MutationResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; error: ProductMutationError }>;

export type ProductSubmissionDependencies = Readonly<{
  limits: ProductLimits;
  getActorId: () => Promise<string | null>;
  create: (
    actorUserId: string,
    categoryId: string,
    input: ProductInput,
  ) => Promise<MutationResult>;
  update: (
    actorUserId: string,
    productId: string,
    categoryId: string,
    input: ProductInput,
  ) => Promise<MutationResult>;
  archive: (actorUserId: string, productId: string) => Promise<MutationResult>;
}>;

export const emptyProductValues: ProductFormValues = {
  categoryId: '',
  name: '',
  description: '',
  calculationType: 'recipe',
  baseLaborMinutes: '0',
  ownMarginPercent: '',
  recipeYieldPortions: '',
  fixedPriceCop: '',
  isPublished: false,
  componentsJson: '[]',
  optionGroupsJson: '[]',
};

// Quantities stay strings end to end; the domain parses them into Quantity.
const quantityText = z.string().max(40);
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

const componentsSchema = z
  .array(
    z.object({
      kind: z.enum(['supply', 'product']),
      referenceId: z.string().max(64),
      quantity: quantityText,
    }),
  )
  .max(100);

const optionGroupsSchema = z
  .array(
    z.object({
      name: z.string().max(200),
      selection: z.enum(['single', 'multiple']),
      required: z.boolean(),
      visible: z.boolean(),
      values: z
        .array(
          z.object({
            name: z.string().max(200),
            extraMaterialCostCop: money,
            extraLaborMinutes: z.number().int().nonnegative(),
            suggestedExtraPriceCop: money.nullable(),
            components: z
              .array(
                z.object({
                  supplyId: z.string().max(64),
                  quantity: quantityText,
                }),
              )
              .max(50),
          }),
        )
        .max(50),
    }),
  )
  .max(20);

const json = <T extends z.ZodType>(target: T) =>
  z.string().transform((text, context): z.infer<T> => {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      value = undefined;
    }
    const parsed = target.safeParse(value);
    if (parsed.success) return parsed.data;
    context.addIssue({ code: 'custom', message: 'invalid' });
    return z.NEVER;
  });

const digits = (max: number) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{1,${max}}$`));
const optional = (max: number) => z.union([z.literal(''), digits(max)]);
const percent = z.union([
  z.literal(''),
  z
    .string()
    .trim()
    .regex(/^\d{1,2}(?:[.,]\d{1,2})?$/),
]);

const schema = (limits: ProductLimits) =>
  z.object({
    categoryId: z.uuid(),
    name: z.string().trim().min(1).max(limits.nameMaxLength),
    description: z.string().trim().min(1).max(limits.descriptionMaxLength),
    calculationType: z.enum([
      'recipe',
      'base_with_extras',
      'bundle',
      'fixed_price',
    ]),
    baseLaborMinutes: digits(6),
    ownMarginPercent: percent,
    recipeYieldPortions: optional(5),
    fixedPriceCop: optional(15),
    isPublished: z.boolean(),
    componentsJson: json(componentsSchema),
    optionGroupsJson: json(optionGroupsSchema),
  });

type Parsed = z.infer<ReturnType<typeof schema>>;

const fields = Object.keys(emptyProductValues) as Field[];

const isField = (name: string): name is Field =>
  Object.hasOwn(emptyProductValues, name);

/** Exact percent text to basis points: `35,5` -> 3550. */
const toBps = (text: string): number | null => {
  if (text.trim() === '') return null;
  const [whole, decimals = ''] = text.trim().split(/[.,]/);
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
};

const toNullableInteger = (text: string): number | null =>
  text.trim() === '' ? null : Number(text);

const toInput = (data: Parsed): ProductInput => ({
  name: data.name,
  description: data.description,
  calculationType: data.calculationType,
  baseLaborMinutes: Number(data.baseLaborMinutes),
  ownMarginBps: toBps(data.ownMarginPercent),
  recipeYieldPortions: toNullableInteger(data.recipeYieldPortions),
  fixedPriceCop: toNullableInteger(data.fixedPriceCop),
  isPublished: data.isPublished,
  components: data.componentsJson,
  optionGroups: data.optionGroupsJson,
});

const readValues = (formData: FormData): ProductFormValues => {
  const read = (name: Field) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  return {
    ...(Object.fromEntries(fields.map((name) => [name, read(name)])) as Omit<
      ProductFormValues,
      'isPublished'
    >),
    isPublished: formData.get('isPublished') === 'on',
  };
};

const fieldMessages: Readonly<Record<Field, string>> = {
  categoryId: 'Elige una categoría.',
  name: 'Escribe un nombre válido, sin exceder el límite.',
  description: 'Escribe una descripción válida.',
  calculationType: 'Elige un tipo de cálculo.',
  baseLaborMinutes: 'Escribe los minutos como un número entero.',
  ownMarginPercent:
    'Escribe un margen menor que 100 %, con hasta dos decimales.',
  recipeYieldPortions:
    'Una receta rinde un número entero de porciones; otros tipos no llevan rendimiento.',
  fixedPriceCop:
    'El precio fijo es obligatorio solo en productos de precio fijo, en pesos enteros.',
  isPublished: 'Valor inválido.',
  componentsJson:
    'Revisa los componentes: cantidades positivas (0,25, 1/3 o 1 1/2) e insumos o productos válidos.',
  optionGroupsJson:
    'Revisa las opciones: nombres únicos, al menos un valor, montos y minutos enteros.',
};

/** Domain paths (`components.0.quantity`) map to the form field that owns them. */
const formField = (path: string): Field => {
  const root = path.split('.')[0];
  if (root === 'components') return 'componentsJson';
  if (root === 'optionGroups') return 'optionGroupsJson';
  if (root === 'ownMarginBps') return 'ownMarginPercent';
  return isField(root) ? root : 'name';
};

const fieldErrors = (paths: readonly string[]) =>
  Object.fromEntries(
    paths.map(formField).map((name) => [name, fieldMessages[name]]),
  );

/**
 * Initial state of the editor for a stored product: rows that violate the
 * current rules open with the offending fields already flagged.
 */
export const reviewFormState = (
  validationIssues: readonly string[],
): ProductFormState =>
  validationIssues.length === 0
    ? { status: 'idle' }
    : { status: 'idle', fieldErrors: fieldErrors(validationIssues) };

const unauthorized: ProductFormState = {
  status: 'error',
  message: 'No autorizado.',
};

const errorMessages: Readonly<
  Record<Exclude<ProductMutationError['code'], 'PRODUCT_INVALID'>, string>
> = {
  UNAUTHORIZED: 'No autorizado.',
  PRODUCT_NOT_FOUND: 'El producto no existe o ya fue archivado.',
  PRODUCT_CATEGORY_NOT_FOUND: 'La categoría elegida ya no existe.',
  PRODUCT_NAME_TAKEN:
    'Ya existe un producto con ese nombre en la categoría, incluso si está archivado.',
  PRODUCT_IN_USE_BY_BUNDLE:
    'No se puede archivar: este producto está siendo usado por uno o más combos.',
  PRODUCT_USED_AS_BUNDLE_COMPONENT:
    'No se puede convertir en combo: este producto está siendo usado como componente de otro combo.',
};

const toState = (
  result: MutationResult,
  values: ProductFormValues,
  savedMessage: string,
): ProductFormState => {
  if (result.ok) return { status: 'saved', message: savedMessage };
  if (result.error.code === 'PRODUCT_INVALID') {
    return {
      status: 'error',
      fieldErrors: fieldErrors(result.error.fields),
      values,
    };
  }
  if (result.error.code === 'UNAUTHORIZED') return unauthorized;
  return { status: 'error', message: errorMessages[result.error.code], values };
};

type Execute = (
  actorUserId: string,
  categoryId: string,
  input: ProductInput,
) => Promise<MutationResult>;

const submit = async (
  dependencies: ProductSubmissionDependencies,
  formData: FormData,
  execute: Execute,
  savedMessage: string,
): Promise<ProductFormState> => {
  const actorUserId = await dependencies.getActorId();
  if (!actorUserId) return unauthorized;

  const values = readValues(formData);
  const parsed = schema(dependencies.limits).safeParse(values);
  if (!parsed.success) {
    return {
      status: 'error',
      fieldErrors: fieldErrors(
        parsed.error.issues.map((issue) => String(issue.path[0])),
      ),
      values,
    };
  }

  return toState(
    await execute(actorUserId, parsed.data.categoryId, toInput(parsed.data)),
    values,
    savedMessage,
  );
};

/** Every write re-checks the admin actor; layout protection is not enough. */
export const submitNewProduct = (
  dependencies: ProductSubmissionDependencies,
  formData: FormData,
) => submit(dependencies, formData, dependencies.create, 'Producto creado.');

export const submitProductChanges = (
  dependencies: ProductSubmissionDependencies,
  productId: string,
  formData: FormData,
) =>
  submit(
    dependencies,
    formData,
    (actorUserId, categoryId, input) =>
      dependencies.update(actorUserId, productId, categoryId, input),
    'Cambios guardados.',
  );

export const submitProductArchive = async (
  dependencies: ProductSubmissionDependencies,
  productId: string,
): Promise<ProductFormState> => {
  const actorUserId = await dependencies.getActorId();
  if (!actorUserId) return unauthorized;

  const result = await dependencies.archive(actorUserId, productId);
  if (result.ok) return { status: 'saved', message: 'Producto archivado.' };
  return toState(result, emptyProductValues, '');
};

/** Saved product as editable form text (bps back to a Spanish percent). */
export const toProductFormValues = (
  categoryId: string,
  input: ProductInput,
): ProductFormValues => {
  const bps = input.ownMarginBps;
  const cents = bps === null ? 0 : bps % 100;
  const margin =
    bps === null
      ? ''
      : `${Math.trunc(bps / 100)}${cents === 0 ? '' : `,${String(cents).padStart(2, '0')}`}`;
  return {
    categoryId,
    name: input.name,
    description: input.description,
    calculationType: input.calculationType,
    baseLaborMinutes: String(input.baseLaborMinutes),
    ownMarginPercent: margin,
    recipeYieldPortions: input.recipeYieldPortions?.toString() ?? '',
    fixedPriceCop: input.fixedPriceCop?.toString() ?? '',
    isPublished: input.isPublished,
    componentsJson: JSON.stringify(input.components),
    optionGroupsJson: JSON.stringify(input.optionGroups),
  };
};
