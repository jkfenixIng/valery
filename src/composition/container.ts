import { resolveAdminAccess } from '@/modules/auth/application/admin-access';
import {
  createAuthenticationGateway,
  createSessionReader,
  handleAuthRequest,
} from '@/modules/auth/infrastructure';

const authentication = createAuthenticationGateway();

export const container = {
  auth: {
    enableTwoFactor: authentication.enableTwoFactor,
    getAdminAccess: (headers: Headers) =>
      resolveAdminAccess(createSessionReader(), headers),
    handleRequest: handleAuthRequest,
    signIn: authentication.signIn,
    signOut: authentication.signOut,
    verifyBackupCode: authentication.verifyBackupCode,
    verifyTotp: authentication.verifyTotp,
  },
} as const;
