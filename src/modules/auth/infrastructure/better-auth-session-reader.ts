import type { AuthSession, SessionReader } from '../application/admin-access';
import type { ValeryAuth } from './auth';

export class BetterAuthSessionReader implements SessionReader {
  constructor(private readonly auth: ValeryAuth) {}

  async getSession(headers: Headers): Promise<AuthSession | null> {
    const session = await this.auth.api.getSession({ headers });

    if (!session) {
      return null;
    }

    return {
      twoFactorEnabled: session.user.twoFactorEnabled === true,
      userId: session.user.id,
    };
  }
}
