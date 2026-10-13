import { describe, expect, it } from 'vitest';

import type { AuditEvent } from '../domain/audit-event';
import type { LockoutState } from '../domain/lockout-policy';
import type { LockoutAttemptStore } from './lockout-attempt-store';
import { SignInAttempts } from './sign-in-attempts';

class MemoryStore implements LockoutAttemptStore {
  readonly states = new Map<string, Required<LockoutState>>();
  async clear(subject: string) {
    this.states.delete(subject);
  }
  async get(subject: string) {
    return this.states.get(subject) ?? null;
  }
  async save(subject: string, state: Required<LockoutState>) {
    this.states.set(subject, state);
  }
}

const createAttempts = () => {
  const store = new MemoryStore();
  const events: AuditEvent[] = [];
  const now = new Date('2026-10-13T12:00:00.000Z');
  const attempts = new SignInAttempts({
    auditLog: { write: async (event) => void events.push(event) },
    clock: () => now,
    hashSubject: () => 'b'.repeat(64),
    store,
  });

  return { attempts, events, store };
};

describe('SignInAttempts', () => {
  it('blocks the sixth attempt after five failures and audits it without the email', async () => {
    const { attempts, events } = createAttempts();

    for (let failure = 0; failure < 5; failure += 1) {
      await attempts.recordFailure('Admin@Example.test');
    }

    await expect(attempts.isAllowed('admin@example.test')).resolves.toBe(false);
    expect(events.at(-1)?.toRecord()).toEqual({
      eventType: 'auth.sign_in',
      outcome: 'blocked',
      actorUserId: null,
      subjectHash: 'b'.repeat(64),
      metadata: { reason: 'locked' },
    });
    expect(
      JSON.stringify(events.map((event) => event.toRecord())),
    ).not.toContain('example.test');
  });

  it('clears failures after a successful password verification', async () => {
    const { attempts, store } = createAttempts();

    await attempts.recordFailure('admin@example.test');
    await attempts.recordSuccess('admin@example.test', 'user-1');

    expect(store.states.size).toBe(0);
    await expect(attempts.isAllowed('admin@example.test')).resolves.toBe(true);
  });
});
