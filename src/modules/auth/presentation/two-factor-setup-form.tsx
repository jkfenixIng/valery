'use client';

import { useActionState } from 'react';

import { Field, GlassButton, GlassCard } from '@/shared/ui';

import { beginTwoFactorSetup, verifyTotp, type FormState } from './actions';

const initialState: FormState = {};

export function TwoFactorSetupForm() {
  const [setupState, setupAction, setupPending] = useActionState(
    beginTwoFactorSetup,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyTotp,
    initialState,
  );

  if (!setupState.secret) {
    return (
      <GlassCard className="auth-card">
        <h1>Configura la verificación en dos pasos</h1>
        <p>
          Esta cuenta requiere una aplicación autenticadora antes de entrar al
          panel.
        </p>
        <form action={setupAction} className="auth-form">
          <Field label="Contraseña" name="password" required type="password" />
          {setupState.message ? <p role="alert">{setupState.message}</p> : null}
          <GlassButton loading={setupPending} type="submit">
            Generar código de configuración
          </GlassButton>
        </form>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="auth-card">
      <h1>Guarda tus códigos de recuperación</h1>
      <p>
        Ingresa este secreto en tu aplicación autenticadora y conserva los
        códigos fuera de Valery. Solo se muestran ahora.
      </p>
      <p>
        <strong>Secreto manual:</strong>{' '}
        <code data-testid="totp-secret">{setupState.secret}</code>
      </p>
      <p>
        <strong>URI:</strong> <code>{setupState.totpUri}</code>
      </p>
      <ul aria-label="Códigos de recuperación">
        {setupState.backupCodes?.map((code) => (
          <li key={code}>
            <code data-testid="backup-code">{code}</code>
          </li>
        ))}
      </ul>
      <form action={verifyAction} className="auth-form">
        <Field
          inputMode="numeric"
          label="Código de seis dígitos"
          name="code"
          required
        />
        {verifyState.message ? <p role="alert">{verifyState.message}</p> : null}
        <GlassButton loading={verifyPending} type="submit">
          Activar verificación
        </GlassButton>
      </form>
    </GlassCard>
  );
}
