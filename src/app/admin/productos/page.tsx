import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { container } from '@/composition/container';
import { ProductForm } from '@/modules/products/presentation';
import { GlassCard } from '@/shared/ui';

const typeNames = {
  recipe: 'Receta',
  base_with_extras: 'Base con extras',
  bundle: 'Combo',
  fixed_price: 'Precio fijo',
} as const;

export default async function ProductsPage() {
  if (!(await container.auth.getAdminActorId(await headers()))) {
    redirect('/auth/sign-in');
  }

  const [products, categories, supplies, bundleProducts] = await Promise.all([
    container.products.listActive(),
    container.products.listCategories(),
    container.products.listActiveSupplies(),
    container.products.listBundleProducts(),
  ]);

  return (
    <main className="auth-page">
      <GlassCard className="auth-card">
        <h1>Productos</h1>
        {products.length === 0 ? (
          <p>Aún no hay productos activos.</p>
        ) : (
          <ul>
            {products.map((product) => (
              <li key={product.id}>
                <Link href={`/admin/productos/${product.id}`}>
                  {product.name}
                </Link>{' '}
                — {typeNames[product.calculationType]}
                {product.isPublished ? ' · publicado' : ''}
                {product.needsReview ? ' · Requiere revisión' : ''}
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
      <GlassCard className="auth-card">
        <h2>Nuevo producto</h2>
        {categories.length === 0 ? (
          <p>Primero crea una categoría para registrar productos.</p>
        ) : (
          <ProductForm
            bundleProducts={bundleProducts}
            categories={categories}
            limits={container.products.limits}
            supplies={supplies}
          />
        )}
      </GlassCard>
    </main>
  );
}
