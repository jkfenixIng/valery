import { AuditEvent } from '../domain/audit-event';
import { LockoutPolicy } from '../domain/lockout-policy';
import type { AuditLogWriter } from './audit-log-writer';
import type { LockoutAttemptStore } from './lockout-attempt-store';

type Dependencies = Readonly<{
  auditLog: AuditLogWriter;
  clock: () => Date;
  hashSubject: (email: string) => string;
  store: LockoutAttemptStore;
}>;

export class SignInAttempts {
  private readonly policy = new LockoutPolicy();

  constructor(private readonly dependencies: Dependencies) {}

  async isAllowed(email: string): Promise<boolean> {
    const subjectHash = this.dependencies.hashSubject(email);
    const state = await this.dependencies.store.get(subjectHash);
    const allowed = !this.policy.isLocked(state, this.dependencies.clock());

    if (!allowed) {
      await this.dependencies.auditLog.write(
        AuditEvent.create({
          eventType: 'auth.sign_in',
          outcome: 'blocked',
          subjectHash,
          metadata: { reason: 'locked' },
        }),
      );
    }

    return allowed;
  }

  async recordFailure(email: string): Promise<void> {
    const subjectHash = this.dependencies.hashSubject(email);
    const state = await this.dependencies.store.get(subjectHash);
    await this.dependencies.store.save(
      subjectHash,
      this.policy.recordFailure(state, this.dependencies.clock()),
    );
    await this.dependencies.auditLog.write(
      AuditEvent.create({
        eventType: 'auth.sign_in',
        outcome: 'failure',
        subjectHash,
      }),
    );
  }

  async recordSuccess(
    email: string,
    actorUserId: string | null,
  ): Promise<void> {
    const subjectHash = this.dependencies.hashSubject(email);
    await this.dependencies.store.clear(subjectHash);
    await this.dependencies.auditLog.write(
      AuditEvent.create({
        eventType: 'auth.sign_in',
        outcome: 'success',
        actorUserId,
        subjectHash,
      }),
    );
  }
}
