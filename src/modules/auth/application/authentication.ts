export type SignInResult = 'signed_in' | 'two_factor_required' | 'rejected';

export type TwoFactorEnrollment = Readonly<{
  backupCodes: readonly string[];
  secret: string;
  totpUri: string;
}>;

export interface AuthenticationGateway {
  enableTwoFactor(password: string): Promise<TwoFactorEnrollment | null>;
  signIn(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
  verifyBackupCode(code: string): Promise<boolean>;
  verifyTotp(code: string): Promise<boolean>;
}

export const secretFromTotpUri = (totpUri: string): string =>
  new URL(totpUri).searchParams.get('secret') ?? '';
