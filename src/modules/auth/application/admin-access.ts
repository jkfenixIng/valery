export type AuthSession = Readonly<{
  twoFactorEnabled: boolean;
  userId: string;
}>;

export interface SessionReader {
  getSession(headers: Headers): Promise<AuthSession | null>;
}

export type AdminAccess = 'anonymous' | 'two_factor_setup_required' | 'granted';

export const resolveAdminAccess = async (
  sessions: SessionReader,
  headers: Headers,
): Promise<AdminAccess> => {
  const session = await sessions.getSession(headers);

  if (!session) {
    return 'anonymous';
  }

  return session.twoFactorEnabled ? 'granted' : 'two_factor_setup_required';
};
