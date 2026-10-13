'use client';

import { useActionState } from 'react';

import { Field, GlassButton, GlassCard } from '@/shared/ui';

import { signIn, type FormState } from './actions';

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, {} as FormState);

  return (
    <GlassCard className="auth-card">
      <h1>Iniciar sesión</h1>
      <form action={action} className="auth-form">
        <Field
          autoComplete="username"
          label="Correo"
          name="email"
          required
          type="email"
        />
        <Field
          autoComplete="current-password"
          label="Contraseña"
          name="password"
          required
          type="password"
        />
        {state.message ? <p role="alert">{state.message}</p> : null}
        <GlassButton loading={pending} type="submit">
          Entrar
        </GlassButton>
      </form>
    </GlassCard>
  );
}
