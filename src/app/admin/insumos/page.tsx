import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { container } from '@/composition/container';
import { SupplyForm } from '@/modules/supplies/presentation';
import { GlassCard } from '@/shared/ui';

const pesos = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export default async function SuppliesPage() {
  if (!(await container.auth.getAdminActorId(await headers()))) {
    redirect('/auth/sign-in');
  }

  const [supplies, categories] = await Promise.all([
    container.supplies.listActive(),
    container.supplies.listCategories(),
  ]);

  return (
    <main className="auth-page">
      <GlassCard className="auth-card">
        <h1>Insumos</h1>
        {supplies.length === 0 ? (
          <p>Aún no hay insumos activos.</p>
        ) : (
          <ul>
            {supplies.map((supply) => (
              <li key={supply.id}>
                <Link href={`/admin/insumos/${supply.id}`}>{supply.name}</Link>{' '}
                — {pesos.format(supply.unitCostCop)} por {supply.unit}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
      <GlassCard className="auth-card">
        <h2>Nuevo insumo</h2>
        {categories.length === 0 ? (
          <p>Primero crea una categoría para registrar insumos.</p>
        ) : (
          <SupplyForm
            categories={categories}
            limits={container.supplies.limits}
          />
        )}
      </GlassCard>
    </main>
  );
}
