import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  'PostgreSQL integration (skipped when DATABASE_URL is not configured)',
  () => {
    it('connects to PostgreSQL and exposes the seeded F0 records', async () => {
      const { closeDatabase, database } = await import('./client');
      const { products, settings } = await import('./schema');

      try {
        const configuredSettings = await database.select().from(settings);
        const seededProducts = await database.select().from(products);

        expect(configuredSettings.length).toBeGreaterThan(0);
        expect(seededProducts.map((product) => product.name)).toEqual(
          expect.arrayContaining([
            'Torta',
            'Postre individual',
            'Bolsa de regalo',
          ]),
        );
      } finally {
        await closeDatabase();
      }
    });
  },
);
