import { z } from 'zod';

import type {
  SupplyInput,
  SupplyLimits,
  SupplyMutationError,
} from '@/composition/container';

export type SupplyFormValues = Readonly<{
  categoryId: string;
  name: string;
  unit: string;
  unitCostCop: string;
}>;

type Field = keyof SupplyFormValues;

export type SupplyFormState = Readonly<{
  status: 'idle' | 'saved' | 'error';
  message?: string;
  fieldErrors?: Partial<Record<Field, string>>;
  values?: SupplyFormValues;
}>;

type MutationResult =
  Readonly<{ ok: true }> | Readonly<{ ok: false; error: SupplyMutationError }>;

export type SupplySubmissionDependencies = Readonly<{
  /** Domain technical safeguards (name 120, unit 32), mirrored at this boundary. */
  limits: SupplyLimits;
  getActorId: () => Promise<string | null>;
  create: (
    actorUserId: string,
    categoryId: string,
    input: SupplyInput,
  ) => Promise<MutationResult>;
  update: (
    actorUserId: string,
    supplyId: string,
    input: SupplyInput,
  ) => Promise<MutationResult>;
  archive: (actorUserId: string, supplyId: string) => Promise<MutationResult>;
}>;

const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const detailsSchema = (limits: SupplyLimits) =>
  z.object({
    name: text(limits.nameMaxLength),
    unit: text(limits.unitMaxLength),
    // Whole pesos only; 15 digits stays within Number.MAX_SAFE_INTEGER.
    unitCostCop: z
      .string()
      .trim()
      .regex(/^\d{1,15}$/),
  });
const createSchema = (limits: SupplyLimits) =>
  detailsSchema(limits).extend({ categoryId: z.uuid() });

type Details = z.infer<ReturnType<typeof detailsSchema>>;

const fields: readonly Field[] = ['categoryId', 'name', 'unit', 'unitCostCop'];

const fieldMessage = (field: Field) => {
  if (field === 'categoryId') return 'Elige una categoría.';
  if (field === 'name')
    return 'Escribe un nombre válido, sin exceder el límite.';
  if (field === 'unit') return 'Escribe una unidad válida, por ejemplo g o ml.';
  return 'Escribe un costo entero en pesos, igual o mayor que 0.';
};

const unauthorized: SupplyFormState = {
  status: 'error',
  message: 'No autorizado.',
};

const isField = (name: string): name is Field =>
  (fields as readonly string[]).includes(name);

const fieldErrors = (names: readonly string[]) =>
  Object.fromEntries(
    names.filter(isField).map((field) => [field, fieldMessage(field)]),
  );

const readValues = (formData: FormData): SupplyFormValues => {
  const read = (name: Field) => {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
  };
  return {
    categoryId: read('categoryId'),
    name: read('name'),
    unit: read('unit'),
    unitCostCop: read('unitCostCop'),
  };
};

const toInput = (data: Details): SupplyInput => ({
  name: data.name,
  unit: data.unit,
  unitCostCop: Number(data.unitCostCop),
});

const boundaryErrors = (error: z.ZodError, values: SupplyFormValues) => ({
  status: 'error' as const,
  fieldErrors: fieldErrors(error.issues.map((issue) => String(issue.path[0]))),
  values,
});

const errorMessages: Readonly<
  Record<Exclude<SupplyMutationError['code'], 'SUPPLY_INVALID'>, string>
> = {
  UNAUTHORIZED: 'No autorizado.',
  SUPPLY_NOT_FOUND: 'El insumo no existe o ya fue archivado.',
  SUPPLY_CATEGORY_NOT_FOUND: 'La categoría elegida ya no existe.',
  SUPPLY_NAME_TAKEN:
    'Ya existe un insumo con ese nombre en la categoría, incluso si está archivado.',
};

const toState = (
  result: MutationResult,
  values: SupplyFormValues,
  savedMessage: string,
): SupplyFormState => {
  if (result.ok) return { status: 'saved', message: savedMessage };
  if (result.error.code === 'SUPPLY_INVALID') {
    return {
      status: 'error',
      fieldErrors: fieldErrors(result.error.fields),
      values,
    };
  }
  if (result.error.code === 'UNAUTHORIZED') return unauthorized;
  return { status: 'error', message: errorMessages[result.error.code], values };
};

/** Every write re-checks the admin actor; layout protection is not enough. */
export const submitNewSupply = async (
  dependencies: SupplySubmissionDependencies,
  formData: FormData,
): Promise<SupplyFormState> => {
  const actorUserId = await dependencies.getActorId();
  if (!actorUserId) return unauthorized;

  const values = readValues(formData);
  const parsed = createSchema(dependencies.limits).safeParse(values);
  if (!parsed.success) return boundaryErrors(parsed.error, values);

  return toState(
    await dependencies.create(
      actorUserId,
      parsed.data.categoryId,
      toInput(parsed.data),
    ),
    values,
    'Insumo creado.',
  );
};

export const submitSupplyChanges = async (
  dependencies: SupplySubmissionDependencies,
  supplyId: string,
  formData: FormData,
): Promise<SupplyFormState> => {
  const actorUserId = await dependencies.getActorId();
  if (!actorUserId) return unauthorized;

  const values = readValues(formData);
  const parsed = detailsSchema(dependencies.limits).safeParse(values);
  if (!parsed.success) return boundaryErrors(parsed.error, values);

  return toState(
    await dependencies.update(actorUserId, supplyId, toInput(parsed.data)),
    values,
    'Cambios guardados.',
  );
};

export const submitSupplyArchive = async (
  dependencies: SupplySubmissionDependencies,
  supplyId: string,
): Promise<SupplyFormState> => {
  const actorUserId = await dependencies.getActorId();
  if (!actorUserId) return unauthorized;

  const result = await dependencies.archive(actorUserId, supplyId);
  if (result.ok) return { status: 'saved', message: 'Insumo archivado.' };
  return toState(result, readValues(new FormData()), '');
};
