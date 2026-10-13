import { describe, expect, it } from 'vitest';

import { resolveAdminAccess, type AuthSession } from './admin-access';

const reader = (session: AuthSession | null) => ({
  getSession: async () => session,
});

describe('resolveAdminAccess', () => {
  it.each([
    [null, 'anonymous'],
    [{ userId: 'u1', twoFactorEnabled: false }, 'two_factor_setup_required'],
    [{ userId: 'u1', twoFactorEnabled: true }, 'granted'],
  ] as const)('maps session %o to %s', async (session, expected) => {
    await expect(
      resolveAdminAccess(reader(session), new Headers()),
    ).resolves.toBe(expected);
  });
});
