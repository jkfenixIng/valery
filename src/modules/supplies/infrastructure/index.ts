import type { SupplyRepository } from '../application/supply-repository';

let repositoryPromise: Promise<SupplyRepository> | undefined;

/** Lazy so builds and routes unrelated to supplies do not require DATABASE_URL. */
export const createSupplyRepository = (): SupplyRepository => ({
  listActive: async () => (await getRepository()).listActive(),
  findActive: async (id) => (await getRepository()).findActive(id),
  listCategories: async () => (await getRepository()).listCategories(),
  create: async (categoryId, supply, audit) =>
    (await getRepository()).create(categoryId, supply, audit),
  update: async (id, supply, audit) =>
    (await getRepository()).update(id, supply, audit),
  archive: async (id, audit) => (await getRepository()).archive(id, audit),
});

const getRepository = (): Promise<SupplyRepository> => {
  repositoryPromise ??= Promise.all([
    import('./drizzle-supply-repository'),
    import('@/shared/infrastructure/db/client'),
  ]).then(
    ([{ DrizzleSupplyRepository }, { database }]) =>
      new DrizzleSupplyRepository(database),
  );
  return repositoryPromise;
};
