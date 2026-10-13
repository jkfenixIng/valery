'use client';

import { useActionState } from 'react';

import { Field, GlassButton, GlassCard } from '@/shared/ui';

import { verifyBackupCode, verifyTotp, type FormState } from './actions';

export function TwoFactorForm() {
  const [totpState, totpAction, totpPending] = useActionState(
    verifyTotp,
    {} as FormState,
  );
  const [backupState, backupAction, backupPending] = useActionState(
    verifyBackupCode,
    {} as FormState,
  );

  return (
    <GlassCard className="auth-card">
      <h1>Verificación en dos pasos</h1>
      <form action={totpAction} className="auth-form">
        <Field
          autoComplete="one-time-code"
          inputMode="numeric"
          label="Código de la aplicación"
          name="code"
          required
        />
        {totpState.message ? <p role="alert">{totpState.message}</p> : null}
        <GlassButton loading={totpPending} type="submit">
          Verificar
        </GlassButton>
      </form>
      <form action={backupAction} className="auth-form">
        <Field
          id="backup-code"
          label="Código de recuperación"
          name="code"
          required
        />
        {backupState.message ? <p role="alert">{backupState.message}</p> : null}
        <GlassButton loading={backupPending} type="submit" variant="secondary">
          Usar código de recuperación
        </GlassButton>
      </form>
    </GlassCard>
  );
}
