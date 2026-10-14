'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { container } from '@/composition/container';

import {
  submitNewProduct,
  submitProductArchive,
  submitProductChanges,
  type ProductFormState,
  type ProductSubmissionDependencies,
} from './product-submission';

const dependencies: ProductSubmissionDependencies = {
  limits: container.products.limits,
  // Re-checked on every mutation: a user id only with a TOTP-enabled session.
  getActorId: async () => container.auth.getAdminActorId(await headers()),
  create: container.products.create,
  update: container.products.update,
  archive: container.products.archive,
};

const refreshCatalog = (state: ProductFormState) => {
  if (state.status === 'saved') revalidatePath('/admin/productos');
  return state;
};

export const createProductAction = async (
  previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> => {
  void previousState;
  return refreshCatalog(await submitNewProduct(dependencies, formData));
};

export const updateProductAction = async (
  productId: string,
  previousState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> => {
  void previousState;
  return refreshCatalog(
    await submitProductChanges(dependencies, productId, formData),
  );
};

/** POST-only server action; archiving never happens on GET. */
export const archiveProductAction = async (
  productId: string,
  previousState: ProductFormState,
): Promise<ProductFormState> => {
  void previousState;
  const state = refreshCatalog(
    await submitProductArchive(dependencies, productId),
  );
  if (state.status === 'saved') redirect('/admin/productos');
  return state;
};
