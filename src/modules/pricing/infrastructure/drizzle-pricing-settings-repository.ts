import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { auditLogs, settings } from '@/shared/infrastructure/db/schema';

import type { AuditEvent } from '../../auth/domain/audit-event';
import type { PricingSettingsRepository } from '../application/pricing-settings-repository';
import type { PricingSettingsRecord } from '../domain/pricing-settings';

export const pricingSettingKeys = {
  hourlyRateCop: 'pricing.hourly_rate_cop',
  marginBps: 'pricing.margin_bps',
  overheadBps: 'pricing.overhead_bps',
  priceRoundingMultipleCop: 'pricing.price_rounding_multiple_cop',
} as const satisfies Record<keyof PricingSettingsRecord, string>;

const fields = Object.keys(
  pricingSettingKeys,
) as (keyof PricingSettingsRecord)[];

export class DrizzlePricingSettingsRepository implements PricingSettingsRepository {
  constructor(private readonly database: NodePgDatabase) {}

  async load(): Promise<Partial<PricingSettingsRecord>> {
    const rows = await this.database
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(inArray(settings.key, Object.values(pricingSettingKeys)));
    const values = new Map(rows.map((row) => [row.key, row.value]));

    return Object.fromEntries(
      fields.map((field) => [field, values.get(pricingSettingKeys[field])]),
    );
  }

  async save(record: PricingSettingsRecord, audit: AuditEvent): Promise<void> {
    const event = audit.toRecord();

    await this.database.transaction(async (transaction) => {
      for (const field of fields) {
        const value = record[field];
        await transaction
          .insert(settings)
          .values({ key: pricingSettingKeys[field], value })
          .onConflictDoUpdate({ target: settings.key, set: { value } });
      }

      await transaction.insert(auditLogs).values({
        actorUserId: event.actorUserId,
        eventType: event.eventType,
        metadata: event.metadata,
        outcome: event.outcome,
        subjectHash: event.subjectHash,
      });
    });
  }
}
