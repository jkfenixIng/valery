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

    it('creates, edits and archives supplies atomically with audit rows', async () => {
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const { closeDatabase, database } = await import('./client');
      const { auditLogs, categories, supplies, users } =
        await import('./schema');
      const { AuditEvent } =
        await import('../../../modules/auth/domain/audit-event');
      const { DrizzleSupplyRepository } =
        await import('../../../modules/supplies/infrastructure/drizzle-supply-repository');

      const actorId = 'f1-03-integration-actor';
      const categoryName = 'f1-03-integration-category';
      const audit = (
        eventType: 'supply.created' | 'supply.updated' | 'supply.archived',
      ) =>
        AuditEvent.create({
          eventType,
          outcome: 'success',
          actorUserId: actorId,
          metadata: { method: 'admin_supply_form' },
        });
      const details = { name: 'Harina', unit: 'g', unitCostCop: 12 };

      try {
        await migrate(database, { migrationsFolder: 'drizzle' });
        await database
          .insert(users)
          .values({
            id: actorId,
            name: 'Prueba',
            email: `${actorId}@test.invalid`,
          })
          .onConflictDoNothing();
        const [category] = await database
          .insert(categories)
          .values({ name: categoryName })
          .returning();
        const repository = new DrizzleSupplyRepository(database);

        try {
          const created = await repository.create(
            category.id,
            details,
            audit('supply.created'),
          );
          if (!created.ok) throw new Error('Supply was not created.');
          const id = created.supply.id;

          await expect(
            repository.create(category.id, details, audit('supply.created')),
          ).resolves.toEqual({ ok: false, reason: 'name_taken' });
          await expect(
            repository.update(
              id,
              { ...details, unitCostCop: 15 },
              audit('supply.updated'),
            ),
          ).resolves.toMatchObject({ ok: true, supply: { unitCostCop: 15 } });
          await expect(
            repository.archive(id, audit('supply.archived')),
          ).resolves.toBe(true);
          await expect(
            repository.archive(id, audit('supply.archived')),
          ).resolves.toBe(false);
          await expect(
            repository.update(id, details, audit('supply.updated')),
          ).resolves.toEqual({ ok: false, reason: 'not_found' });
          await expect(repository.findActive(id)).resolves.toBeNull();

          const [row] = await database
            .select()
            .from(supplies)
            .where(eq(supplies.id, id));
          expect(row.deletedAt).toBeInstanceOf(Date);
          expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(
            row.createdAt.getTime(),
          );

          const audits = await database
            .select()
            .from(auditLogs)
            .where(eq(auditLogs.actorUserId, actorId));
          expect(audits.map((entry) => entry.eventType).sort()).toEqual([
            'supply.archived',
            'supply.created',
            'supply.updated',
          ]);
          expect(
            new Set(audits.map((entry) => JSON.stringify(entry.metadata))),
          ).toEqual(new Set([JSON.stringify({ method: 'admin_supply_form' })]));
        } finally {
          await database
            .delete(auditLogs)
            .where(eq(auditLogs.actorUserId, actorId));
          await database
            .delete(supplies)
            .where(eq(supplies.categoryId, category.id));
          await database
            .delete(categories)
            .where(eq(categories.id, category.id));
          await database.delete(users).where(eq(users.id, actorId));
        }
      } finally {
        await closeDatabase();
      }
    });
  },
);
