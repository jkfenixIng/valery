'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { container } from '@/composition/container';

import {
  submitNewSupply,
  submitSupplyArchive,
  submitSupplyChanges,
  type SupplyFormState,
  type SupplySubmissionDependencies,
} from './supply-submission';

const dependencies: SupplySubmissionDependencies = {
  limits: container.supplies.limits,
  // Re-checked on every mutation: a user id only with a TOTP-enabled session.
  getActorId: async () => container.auth.getAdminActorId(await headers()),
  create: container.supplies.create,
  update: container.supplies.update,
  archive: container.supplies.archive,
};

const refreshCatalog = (state: SupplyFormState) => {
  if (state.status === 'saved') revalidatePath('/admin/insumos');
  return state;
};

export const createSupplyAction = async (
  previousState: SupplyFormState,
  formData: FormData,
): Promise<SupplyFormState> => {
  void previousState;
  return refreshCatalog(await submitNewSupply(dependencies, formData));
};

export const updateSupplyAction = async (
  supplyId: string,
  previousState: SupplyFormState,
  formData: FormData,
): Promise<SupplyFormState> => {
  void previousState;
  return refreshCatalog(
    await submitSupplyChanges(dependencies, supplyId, formData),
  );
};

/** POST-only server action; archiving never happens on GET. */
export const archiveSupplyAction = async (
  supplyId: string,
  previousState: SupplyFormState,
): Promise<SupplyFormState> => {
  void previousState;
  const state = refreshCatalog(
    await submitSupplyArchive(dependencies, supplyId),
  );
  if (state.status === 'saved') redirect('/admin/insumos');
  return state;
};
