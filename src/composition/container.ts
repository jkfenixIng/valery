import { resolveAdminAccess } from '@/modules/auth/application/admin-access';
import { resolveAdminActorId } from '@/modules/auth/application/admin-actor';
import {
  createAuthenticationGateway,
  createSessionReader,
  handleAuthRequest,
} from '@/modules/auth/infrastructure';
import {
  getPricingSettings,
  updatePricingSettings,
} from '@/modules/pricing/application/pricing-settings';
import {
  toPricingSettingsInput,
  type PricingSettingsInput,
} from '@/modules/pricing/domain/pricing-settings';
import { createPricingSettingsRepository } from '@/modules/pricing/infrastructure';

const authentication = createAuthenticationGateway();
const pricingSettings = createPricingSettingsRepository();

export type { PricingSettingsInput };

export type PricingSettingsForm =
  | Readonly<{ status: 'configured'; values: PricingSettingsInput }>
  | Readonly<{ status: 'not_configured' | 'invalid' }>;

export const container = {
  auth: {
    enableTwoFactor: authentication.enableTwoFactor,
    getAdminAccess: (headers: Headers) =>
      resolveAdminAccess(createSessionReader(), headers),
    /** Server-side write authorization: a user id only with a 2FA-enabled session. */
    getAdminActorId: (headers: Headers) =>
      resolveAdminActorId(createSessionReader(), headers),
    handleRequest: handleAuthRequest,
    signIn: authentication.signIn,
    signOut: authentication.signOut,
    verifyBackupCode: authentication.verifyBackupCode,
    verifyTotp: authentication.verifyTotp,
  },
  pricing: {
    /** Saved settings as form text; never substitutes defaults. */
    getSettingsForm: async (): Promise<PricingSettingsForm> => {
      const settings = await getPricingSettings(pricingSettings);
      if (settings.ok) {
        return {
          status: 'configured',
          values: toPricingSettingsInput(settings.value),
        };
      }
      return settings.error.code === 'PRICING_SETTINGS_NOT_CONFIGURED'
        ? { status: 'not_configured' }
        : { status: 'invalid' };
    },
    updateSettings: (actorUserId: string | null, input: PricingSettingsInput) =>
      updatePricingSettings(pricingSettings, { actorUserId, input }),
  },
} as const;
