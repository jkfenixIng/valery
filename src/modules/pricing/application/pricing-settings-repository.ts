import type { AuditEvent } from '../../auth/domain/audit-event';
import type { PricingSettingsRecord } from '../domain/pricing-settings';

export interface PricingSettingsRepository {
  load(): Promise<Partial<PricingSettingsRecord>>;
  /** Saves the settings and audit event in one atomic transaction. */
  save(record: PricingSettingsRecord, audit: AuditEvent): Promise<void>;
}
