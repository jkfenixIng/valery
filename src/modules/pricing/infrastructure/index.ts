import type { PricingSettingsRepository } from '../application/pricing-settings-repository';

let repositoryPromise: Promise<PricingSettingsRepository> | undefined;

/** Lazy because the database URL is not required for builds or public routes. */
export const createPricingSettingsRepository =
  (): PricingSettingsRepository => ({
    load: async () => (await getRepository()).load(),
    save: async (record, audit) => (await getRepository()).save(record, audit),
  });

const getRepository = (): Promise<PricingSettingsRepository> => {
  repositoryPromise ??= Promise.all([
    import('./drizzle-pricing-settings-repository'),
    import('@/shared/infrastructure/db/client'),
  ]).then(
    ([{ DrizzlePricingSettingsRepository }, { database }]) =>
      new DrizzlePricingSettingsRepository(database),
  );
  return repositoryPromise;
};
