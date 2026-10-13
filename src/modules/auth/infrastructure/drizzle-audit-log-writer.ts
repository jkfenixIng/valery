import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { auditLogs } from '@/shared/infrastructure/db/schema';

import type { AuditLogWriter } from '../application/audit-log-writer';
import type { AuditEvent } from '../domain/audit-event';

export class DrizzleAuditLogWriter implements AuditLogWriter {
  constructor(private readonly database: NodePgDatabase) {}

  async write(event: AuditEvent): Promise<void> {
    const record = event.toRecord();
    await this.database.insert(auditLogs).values({
      actorUserId: record.actorUserId,
      eventType: record.eventType,
      metadata: record.metadata,
      outcome: record.outcome,
      subjectHash: record.subjectHash,
    });
  }
}
