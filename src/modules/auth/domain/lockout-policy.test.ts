import { describe, expect, it } from 'vitest';

import { LockoutPolicy } from './lockout-policy';

describe('LockoutPolicy', () => {
  const policy = new LockoutPolicy();
  const startedAt = new Date('2026-10-13T12:00:00.000Z');

  it('locks an account for fifteen minutes after five failures in fifteen minutes', () => {
    const state = policy.recordFailure(
      { failures: 4, lastFailureAt: startedAt },
      startedAt,
    );

    expect(state.lockedUntil).toEqual(new Date('2026-10-13T12:15:00.000Z'));
  });

  it('does not count failures outside the rolling window', () => {
    const state = policy.recordFailure(
      { failures: 4, lastFailureAt: new Date('2026-10-13T11:44:59.999Z') },
      startedAt,
    );

    expect(state.failures).toBe(1);
    expect(state.lockedUntil).toBeNull();
  });

  it('resets failures after a successful password verification', () => {
    expect(policy.reset()).toEqual({
      failures: 0,
      lastFailureAt: null,
      lockedUntil: null,
    });
  });
});
