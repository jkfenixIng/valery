import { inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { config } from '../../../config/env';

const describeDatabase = config.DATABASE_URL ? describe : describe.skip;

describeDatabase(
  'PostgreSQL integration (skipped when DATABASE_URL is not configured)',
  () => {
    it('migrates and seeds the F0 records idempotently', async () => {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const { closeDatabase, database } = await import('./client');
      const { seedDatabase, seedIds } = await import('./seed');
      const { categories, productComponents, products, settings, supplies } =
        await import('./schema');

      try {
        await migrate(database, { migrationsFolder: 'drizzle' });
        await seedDatabase(database);
        await seedDatabase(database);

        const [
          configuredSettings,
          seededCategories,
          seededSupplies,
          seededProducts,
          seededComponents,
        ] = await Promise.all([
          database
            .select()
            .from(settings)
            .where(inArray(settings.id, [seedIds.settings])),
          database
            .select()
            .from(categories)
            .where(inArray(categories.id, [seedIds.cakes, seedIds.desserts])),
          database
            .select()
            .from(supplies)
            .where(inArray(supplies.id, Object.values(seedIds.supplies))),
          database
            .select()
            .from(products)
            .where(inArray(products.id, Object.values(seedIds.products))),
          database
            .select()
            .from(productComponents)
            .where(
              inArray(productComponents.id, Object.values(seedIds.components)),
            ),
        ]);

        expect(configuredSettings).toHaveLength(1);
        expect(seededCategories).toHaveLength(2);
        expect(seededSupplies).toHaveLength(2);
        expect(seededProducts).toHaveLength(3);
        expect(seededComponents).toHaveLength(2);
      } finally {
        await closeDatabase();
      }
    });
  },
);
