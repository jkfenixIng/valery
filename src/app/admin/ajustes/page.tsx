import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { container } from '@/composition/container';
import { PricingSettingsForm } from '@/modules/pricing/presentation';
import { GlassCard } from '@/shared/ui';

export default async function PricingSettingsPage() {
  if (!(await container.auth.getAdminActorId(await headers()))) {
    redirect('/auth/sign-in');
  }

  const settings = await container.pricing.getSettingsForm();

  return (
    <main className="auth-page">
      <GlassCard className="auth-card">
        <h1>Ajustes de precios</h1>
        <p>
          Define la tarifa por hora, el margen, los costos indirectos y el
          redondeo que usa el motor de precios.
        </p>
        {settings.status === 'invalid' ? (
          <p role="alert">
            No fue posible leer los ajustes guardados. Vuelve a guardarlos para
            corregirlos.
          </p>
        ) : null}
        <PricingSettingsForm
          initialValues={
            settings.status === 'configured' ? settings.values : null
          }
        />
      </GlassCard>
    </main>
  );
}
