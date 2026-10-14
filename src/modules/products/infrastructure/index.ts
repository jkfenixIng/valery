import type { ProductRepository } from '../application/product-repository';

let repositoryPromise: Promise<ProductRepository> | undefined;

/** Lazy so builds and unrelated routes do not require DATABASE_URL. */
export const createProductRepository = (): ProductRepository => ({
  listActive: async () => (await getRepository()).listActive(),
  findActive: async (id) => (await getRepository()).findActive(id),
  listCategories: async () => (await getRepository()).listCategories(),
  listActiveSupplies: async () => (await getRepository()).listActiveSupplies(),
  listBundleProducts: async () => (await getRepository()).listBundleProducts(),
  create: async (categoryId, product, audit) =>
    (await getRepository()).create(categoryId, product, audit),
  update: async (id, categoryId, product, audit) =>
    (await getRepository()).update(id, categoryId, product, audit),
  archive: async (id, audit) => (await getRepository()).archive(id, audit),
});

const getRepository = (): Promise<ProductRepository> => {
  repositoryPromise ??= Promise.all([
    import('./drizzle-product-repository'),
    import('@/shared/infrastructure/db/client'),
  ]).then(
    ([{ DrizzleProductRepository }, { database }]) =>
      new DrizzleProductRepository(database),
  );
  return repositoryPromise;
};
