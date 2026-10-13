'use server';

import { redirect } from 'next/navigation';

import { container } from '@/composition/container';

export type FormState = Readonly<{
  backupCodes?: readonly string[];
  message?: string;
  secret?: string;
  totpUri?: string;
}>;

const read = (formData: FormData, name: string): string => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

export const signIn = async (
  _: FormState,
  formData: FormData,
): Promise<FormState> => {
  const result = await container.auth.signIn(
    read(formData, 'email'),
    read(formData, 'password'),
  );
  if (result === 'rejected')
    return { message: 'Correo o contraseña inválidos.' };
  redirect(result === 'two_factor_required' ? '/auth/two-factor' : '/admin');
};

export const beginTwoFactorSetup = async (
  _: FormState,
  formData: FormData,
): Promise<FormState> => {
  const enrollment = await container.auth.enableTwoFactor(
    read(formData, 'password'),
  );
  if (!enrollment)
    return { message: 'No fue posible iniciar la configuración.' };
  return {
    backupCodes: enrollment.backupCodes,
    secret: enrollment.secret,
    totpUri: enrollment.totpUri,
  };
};

export const verifyTotp = async (
  _: FormState,
  formData: FormData,
): Promise<FormState> => {
  if (!(await container.auth.verifyTotp(read(formData, 'code')))) {
    return { message: 'Código de verificación inválido.' };
  }
  redirect('/admin');
};

export const verifyBackupCode = async (
  _: FormState,
  formData: FormData,
): Promise<FormState> => {
  if (!(await container.auth.verifyBackupCode(read(formData, 'code')))) {
    return { message: 'Código de recuperación inválido.' };
  }
  redirect('/admin');
};

export const signOut = async (): Promise<void> => {
  await container.auth.signOut();
  redirect('/auth/sign-in');
};
