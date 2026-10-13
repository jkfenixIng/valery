import type { LockoutState } from '../domain/lockout-policy';

export interface LockoutAttemptStore {
  clear(subjectHash: string): Promise<void>;
  get(subjectHash: string): Promise<LockoutState | null>;
  save(subjectHash: string, state: Required<LockoutState>): Promise<void>;
}
