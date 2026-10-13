export const auditEventTypes = [
  'auth.sign_in',
  'auth.two_factor.enabled',
  'auth.two_factor.verify',
  'auth.backup_code.used',
  'auth.password.changed',
  'auth.sign_out',
] as const;

export type AuditEventType = (typeof auditEventTypes)[number];
export type AuditOutcome = 'success' | 'failure' | 'blocked';
export type AuditMetadata = Readonly<Record<string, string | number | boolean>>;

export type AuditEventRecord = Readonly<{
  eventType: AuditEventType;
  outcome: AuditOutcome;
  actorUserId: string | null;
  subjectHash: string | null;
  metadata: AuditMetadata;
}>;

type AuditEventInput = Readonly<{
  eventType: string;
  outcome: AuditOutcome;
  actorUserId?: string | null;
  subjectHash?: string | null;
  metadata?: AuditMetadata;
}>;

const allowedMetadataKeys = new Set(['reason', 'method']);
const outcomes = new Set<string>(['success', 'failure', 'blocked']);

const isAuditEventType = (value: string): value is AuditEventType =>
  (auditEventTypes as readonly string[]).includes(value);

export class AuditEvent {
  private constructor(private readonly record: AuditEventRecord) {}

  static create(input: AuditEventInput): AuditEvent {
    if (!isAuditEventType(input.eventType)) {
      throw new Error('Unknown audit event type.');
    }
    if (!outcomes.has(input.outcome)) {
      throw new Error('Unknown audit outcome.');
    }
    const metadata = input.metadata ?? {};
    if (Object.keys(metadata).some((key) => !allowedMetadataKeys.has(key))) {
      throw new Error('Audit metadata contains a forbidden key.');
    }
    if (input.subjectHash && !/^[a-f0-9]{64}$/.test(input.subjectHash)) {
      throw new Error('Audit subject must be a SHA-256 hex digest.');
    }

    return new AuditEvent({
      eventType: input.eventType,
      outcome: input.outcome,
      actorUserId: input.actorUserId ?? null,
      subjectHash: input.subjectHash ?? null,
      metadata,
    });
  }

  toRecord(): AuditEventRecord {
    return this.record;
  }
}
