import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { authLockouts } from '@/shared/infrastructure/db/schema';

import type { LockoutAttemptStore } from '../application/lockout-attempt-store';
import type { LockoutState } from '../domain/lockout-policy';

export class DrizzleLockoutAttemptStore implements LockoutAttemptStore {
  constructor(private readonly database: NodePgDatabase) {}

  async clear(subjectHash: string): Promise<void> {
    await this.database
      .delete(authLockouts)
      .where(eq(authLockouts.subjectHash, subjectHash));
  }

  async get(subjectHash: string): Promise<LockoutState | null> {
    const [state] = await this.database
      .select()
      .from(authLockouts)
      .where(eq(authLockouts.subjectHash, subjectHash));
    return state ?? null;
  }

  async save(
    subjectHash: string,
    state: Required<LockoutState>,
  ): Promise<void> {
    await this.database
      .insert(authLockouts)
      .values({ subjectHash, ...state })
      .onConflictDoUpdate({ target: authLockouts.subjectHash, set: state });
  }
}
