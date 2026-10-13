export type LockoutState = Readonly<{
  failures: number;
  lastFailureAt: Date | null;
  lockedUntil?: Date | null;
}>;

const maximumFailures = 5;
const windowMs = 15 * 60 * 1000;
const lockMs = 15 * 60 * 1000;

export class LockoutPolicy {
  isLocked(state: LockoutState | null, now: Date): boolean {
    return Boolean(state?.lockedUntil && state.lockedUntil > now);
  }

  recordFailure(state: LockoutState | null, now: Date): Required<LockoutState> {
    const isWithinWindow =
      state?.lastFailureAt !== null &&
      state?.lastFailureAt !== undefined &&
      now.getTime() - state.lastFailureAt.getTime() <= windowMs;
    const failures = isWithinWindow ? state.failures + 1 : 1;

    return {
      failures,
      lastFailureAt: now,
      lockedUntil:
        failures >= maximumFailures ? new Date(now.getTime() + lockMs) : null,
    };
  }

  reset(): Required<LockoutState> {
    return { failures: 0, lastFailureAt: null, lockedUntil: null };
  }
}
