import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { container } from '@/composition/container';
import {
  ArchiveProductForm,
  ProductForm,
} from '@/modules/products/presentation';
import { GlassCard } from '@/shared/ui';

export default async function EditProductPage({
  params,
}: Readonly<{ params: Promise<{ productId: string }> }>) {
  if (!(await container.auth.getAdminActorId(await headers()))) {
    redirect('/auth/sign-in');
  }

  const { productId } = await params;
  const product = await container.products.getEditable(productId);
  if (!product) notFound();

  const [categories, supplies, bundleProducts] = await Promise.all([
    container.products.listCategories(),
    container.products.listActiveSupplies(),
    container.products.listBundleProducts(),
  ]);

  return (
    <main className="auth-page">
      <GlassCard className="auth-card">
        <Link href="/admin/productos">Volver a productos</Link>
        <h1>Editar producto</h1>
        <ProductForm
          bundleProducts={bundleProducts}
          categories={categories}
          limits={container.products.limits}
          product={product}
          supplies={supplies}
        />
      </GlassCard>
      <GlassCard className="auth-card">
        <h2>Archivar</h2>
        <ArchiveProductForm productId={product.id} />
      </GlassCard>
    </main>
  );
}
