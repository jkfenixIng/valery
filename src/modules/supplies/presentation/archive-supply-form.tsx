'use client';

import { useActionState } from 'react';

import { GlassButton } from '@/shared/ui';

import { archiveSupplyAction } from './actions';
import type { SupplyFormState } from './supply-submission';

export function ArchiveSupplyForm({
  supplyId,
}: Readonly<{ supplyId: string }>) {
  const [state, action, pending] = useActionState(
    archiveSupplyAction.bind(null, supplyId),
    { status: 'idle' } satisfies SupplyFormState,
  );

  return (
    <form action={action} className="auth-form">
      <p>Al archivarlo, dejará de aparecer en el catálogo activo.</p>
      {state.message ? <p role="alert">{state.message}</p> : null}
      <GlassButton loading={pending} type="submit" variant="secondary">
        Archivar insumo
      </GlassButton>
    </form>
  );
}
