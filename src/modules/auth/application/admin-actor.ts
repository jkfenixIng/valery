import type { SessionReader } from './admin-access';

/** Resolves an actor only for a current session that has completed two-factor setup. */
export const resolveAdminActorId = async (
  sessions: SessionReader,
  headers: Headers,
): Promise<string | null> => {
  const session = await sessions.getSession(headers);
  return session?.twoFactorEnabled && session.userId ? session.userId : null;
};
