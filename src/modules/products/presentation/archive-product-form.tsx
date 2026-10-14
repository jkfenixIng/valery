'use client';

import { useActionState } from 'react';

import { GlassButton } from '@/shared/ui';

import { archiveProductAction } from './actions';
import type { ProductFormState } from './product-submission';

export function ArchiveProductForm({
  productId,
}: Readonly<{ productId: string }>) {
  const [state, action, pending] = useActionState(
    archiveProductAction.bind(null, productId),
    { status: 'idle' } satisfies ProductFormState,
  );

  return (
    <form action={action} className="auth-form">
      <p>Al archivarlo, dejará de aparecer en el catálogo activo.</p>
      {state.message ? <p role="alert">{state.message}</p> : null}
      <GlassButton loading={pending} type="submit" variant="secondary">
        Archivar producto
      </GlassButton>
    </form>
  );
}
