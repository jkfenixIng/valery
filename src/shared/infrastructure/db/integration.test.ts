import { and, eq, inArray } from 'drizzle-orm';
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
      const {
        categories,
        productComponents,
        products,
        settings,
        supplies,
        users,
      } = await import('./schema');

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

        if (
          config.ADMIN_EMAIL &&
          config.BETTER_AUTH_SECRET &&
          config.BETTER_AUTH_URL
        ) {
          const { seedAdmin } =
            await import('../../../modules/auth/infrastructure/seed-admin');
          await seedAdmin();
          await seedAdmin();
          const admins = await database
            .select()
            .from(users)
            .where(inArray(users.email, [config.ADMIN_EMAIL.toLowerCase()]));
          expect(admins).toHaveLength(1);
        }
      } finally {
        await closeDatabase();
      }
    });

    it('upserts pricing settings idempotently with one audit row per save', async () => {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const { closeDatabase, database } = await import('./client');
      const { auditLogs, settings, users } = await import('./schema');
      const { AuditEvent } =
        await import('../../../modules/auth/domain/audit-event');
      const { DrizzlePricingSettingsRepository, pricingSettingKeys } =
        await import('../../../modules/pricing/infrastructure/drizzle-pricing-settings-repository');

      const actorId = 'f1-02-integration-actor';
      const keys = Object.values(pricingSettingKeys);
      // PRD section 17 sample parameters; test data only.
      const record = {
        hourlyRateCop: '8000',
        marginBps: '4000',
        overheadBps: '1000',
        priceRoundingMultipleCop: '500',
      };
      const audit = () =>
        AuditEvent.create({
          eventType: 'pricing.settings.updated',
          outcome: 'success',
          actorUserId: actorId,
        });
      const actorAudits = () =>
        database
          .select()
          .from(auditLogs)
          .where(
            and(
              eq(auditLogs.actorUserId, actorId),
              eq(auditLogs.eventType, 'pricing.settings.updated'),
            ),
          );

      try {
        await migrate(database, { migrationsFolder: 'drizzle' });
        const previous = await database
          .select()
          .from(settings)
          .where(inArray(settings.key, keys));
        await database
          .insert(users)
          .values({
            id: actorId,
            name: 'Prueba',
            email: `${actorId}@test.invalid`,
          })
          .onConflictDoNothing();
        const repository = new DrizzlePricingSettingsRepository(database);

        try {
          await repository.save(record, audit());
          await repository.save({ ...record, marginBps: '4050' }, audit());

          expect(
            await database
              .select()
              .from(settings)
              .where(inArray(settings.key, keys)),
          ).toHaveLength(4);
          await expect(repository.load()).resolves.toEqual({
            ...record,
            marginBps: '4050',
          });
          const audits = await actorAudits();
          expect(audits).toHaveLength(2);
          expect(audits.map((row) => row.metadata)).toEqual([{}, {}]);
        } finally {
          await database
            .delete(auditLogs)
            .where(eq(auditLogs.actorUserId, actorId));
          await database.delete(users).where(eq(users.id, actorId));
          await database.delete(settings).where(inArray(settings.key, keys));
          if (previous.length > 0)
            await database.insert(settings).values(previous);
        }
      } finally {
        await closeDatabase();
      }
    });
  },
);
