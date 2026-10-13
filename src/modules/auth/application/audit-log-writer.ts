import type { AuditEvent } from '../domain/audit-event';

export interface AuditLogWriter {
  write(event: AuditEvent): Promise<void>;
}
