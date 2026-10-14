import type { Money } from '../../../shared/domain/Money';
import { err, ok, type Result } from '../../../shared/domain/Result';
import { AuditEvent } from '../../auth/domain/audit-event';
import {
  calculateCost,
  calculateSuggestedPrice,
  type CostBreakdown,
  type CostInput,
  type PricingError,
  type PricingSettings,
} from '../domain/pricing-calculator';
import {
  parsePricingSettings,
  restorePricingSettings,
  toPricingSettingsRecord,
  type PricingSettingsError,
  type PricingSettingsInput,
} from '../domain/pricing-settings';
import type { PricingSettingsRepository } from './pricing-settings-repository';

export type UpdatePricingSettingsError =
  PricingSettingsError | Readonly<{ code: 'UNAUTHORIZED' }>;

export type UpdatePricingSettingsCommand = Readonly<{
  actorUserId: string | null;
  input: PricingSettingsInput;
}>;

export type PricingPreview = Readonly<{
  cost: CostBreakdown;
  suggestedPrice: Money;
}>;

export const getPricingSettings = async (
  repository: PricingSettingsRepository,
): Promise<Result<PricingSettings, PricingSettingsError>> =>
  restorePricingSettings(await repository.load());

export const updatePricingSettings = async (
  repository: PricingSettingsRepository,
  command: UpdatePricingSettingsCommand,
): Promise<Result<PricingSettings, UpdatePricingSettingsError>> => {
  if (!command.actorUserId) return err({ code: 'UNAUTHORIZED' });

  const settings = parsePricingSettings(command.input);
  if (!settings.ok) return settings;

  await repository.save(
    toPricingSettingsRecord(settings.value),
    AuditEvent.create({
      eventType: 'pricing.settings.updated',
      outcome: 'success',
      actorUserId: command.actorUserId,
    }),
  );
  return settings;
};

/** Proves saved settings feed the pricing engine. */
export const previewPricing = async (
  repository: PricingSettingsRepository,
  input: CostInput,
): Promise<Result<PricingPreview, PricingSettingsError | PricingError>> => {
  const settings = await getPricingSettings(repository);
  if (!settings.ok) return settings;

  const cost = calculateCost(input, settings.value);
  if (!cost.ok) return cost;

  const suggestedPrice = calculateSuggestedPrice(
    cost.value.total,
    settings.value,
  );
  if (!suggestedPrice.ok) return suggestedPrice;

  return ok({ cost: cost.value, suggestedPrice: suggestedPrice.value });
};
