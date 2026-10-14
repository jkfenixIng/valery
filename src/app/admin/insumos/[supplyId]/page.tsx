import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { container } from '@/composition/container';
import { ArchiveSupplyForm, SupplyForm } from '@/modules/supplies/presentation';
import { GlassCard } from '@/shared/ui';

export default async function EditSupplyPage({
  params,
}: Readonly<{ params: Promise<{ supplyId: string }> }>) {
  if (!(await container.auth.getAdminActorId(await headers()))) {
    redirect('/auth/sign-in');
  }

  const { supplyId } = await params;
  const supply = await container.supplies.getActive(supplyId);
  if (!supply) notFound();

  return (
    <main className="auth-page">
      <GlassCard className="auth-card">
        <Link href="/admin/insumos">Volver a insumos</Link>
        <h1>Editar insumo</h1>
        <SupplyForm
          categories={[]}
          limits={container.supplies.limits}
          supply={supply}
        />
      </GlassCard>
      <GlassCard className="auth-card">
        <h2>Archivar</h2>
        <ArchiveSupplyForm supplyId={supply.id} />
      </GlassCard>
    </main>
  );
}
