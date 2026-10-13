import type { AuthSession, SessionReader } from '../application/admin-access';
import type { AuthenticationGateway } from '../application/authentication';
import type { ValeryAuth } from './auth';

// Loaded lazily: the database client and auth configuration fail fast at import
// time, and public pages, the build, and smoke tests must not require them.
type AuthRuntime = Readonly<{ auth: ValeryAuth; baseUrl: string }>;
let runtimePromise: Promise<AuthRuntime> | undefined;

const getRuntime = (): Promise<AuthRuntime> => {
  runtimePromise ??= Promise.all([
    import('./auth'),
    import('@/config/env'),
  ]).then(([{ createAuth }, { config, requireAuthConfig }]) => ({
    auth: createAuth(config),
    baseUrl: requireAuthConfig(config).baseUrl,
  }));
  return runtimePromise;
};

export const handleAuthRequest = async (request: Request): Promise<Response> =>
  (await getRuntime()).auth.handler(request);

export const createSessionReader = (): SessionReader => ({
  async getSession(headers: Headers): Promise<AuthSession | null> {
    const { BetterAuthSessionReader } =
      await import('./better-auth-session-reader');
    return new BetterAuthSessionReader((await getRuntime()).auth).getSession(
      headers,
    );
  },
});

const withGateway = async <T>(
  operation: (gateway: AuthenticationGateway) => Promise<T>,
): Promise<T> => {
  const [{ BetterAuthGateway }, { auth, baseUrl }] = await Promise.all([
    import('./better-auth-gateway'),
    getRuntime(),
  ]);
  return operation(new BetterAuthGateway(auth, baseUrl));
};

export const createAuthenticationGateway = (): AuthenticationGateway => ({
  enableTwoFactor: (password) =>
    withGateway((gateway) => gateway.enableTwoFactor(password)),
  signIn: (email, password) =>
    withGateway((gateway) => gateway.signIn(email, password)),
  signOut: () => withGateway((gateway) => gateway.signOut()),
  verifyBackupCode: (code) =>
    withGateway((gateway) => gateway.verifyBackupCode(code)),
  verifyTotp: (code) => withGateway((gateway) => gateway.verifyTotp(code)),
});
