import { describe, expect, it } from 'vitest';

import type { AuthSession } from './admin-access';
import { resolveAdminActorId } from './admin-actor';

const reader = (session: AuthSession | null) => ({
  getSession: async () => session,
});

describe('resolveAdminActorId', () => {
  it.each([
    [null, null],
    [{ userId: 'u1', twoFactorEnabled: false }, null],
    [{ userId: '', twoFactorEnabled: true }, null],
    [{ userId: 'u1', twoFactorEnabled: true }, 'u1'],
  ] as const)('maps session %o to actor %p', async (session, expected) => {
    await expect(
      resolveAdminActorId(reader(session), new Headers()),
    ).resolves.toBe(expected);
  });
});
