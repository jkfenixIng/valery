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
import {
  archiveSupply,
  createSupply,
  getActiveSupply,
  listActiveSupplies,
  listSupplyCategories,
  updateSupply,
} from '@/modules/supplies/application/supplies';
import {
  supplyLimits,
  type SupplyInput,
} from '@/modules/supplies/domain/supply';
import { createSupplyRepository } from '@/modules/supplies/infrastructure';
import {
  archiveProduct,
  createProduct,
  getActiveProduct,
  listActiveProducts,
  listBundleProducts,
  listProductCategories,
  listProductSupplies,
  updateProduct,
} from '@/modules/products/application/products';
import {
  Product,
  productLimits,
  type ProductInput,
} from '@/modules/products/domain/product';
import { createProductRepository } from '@/modules/products/infrastructure';

const authentication = createAuthenticationGateway();
const pricingSettings = createPricingSettingsRepository();
const supplyRepository = createSupplyRepository();
const productRepository = createProductRepository();

export type { PricingSettingsInput };
export type {
  SupplyCategory,
  SupplyRecord,
} from '@/modules/supplies/application/supply-repository';
export type { SupplyMutationError } from '@/modules/supplies/application/supplies';
export type { SupplyInput };
export type SupplyLimits = typeof supplyLimits;
export type {
  BundleProductOption,
  ProductCategory,
  ProductRecord,
  ProductSummary,
  ProductSupplyOption,
} from '@/modules/products/application/product-repository';
export type { ProductMutationError } from '@/modules/products/application/products';
export type { ProductInput };
export type ProductLimits = typeof productLimits;

/** Serializable editor view: exact quantities as canonical `n/d` text. */
export type EditableProduct = Readonly<{
  id: string;
  categoryId: string;
  input: ProductInput;
}>;

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
  supplies: {
    /** Technical length safeguards; the domain enforces them authoritatively. */
    limits: supplyLimits,
    listActive: () => listActiveSupplies(supplyRepository),
    listCategories: () => listSupplyCategories(supplyRepository),
    getActive: (supplyId: string) =>
      getActiveSupply(supplyRepository, supplyId),
    create: (
      actorUserId: string | null,
      categoryId: string,
      input: SupplyInput,
    ) => createSupply(supplyRepository, { actorUserId, categoryId, input }),
    update: (
      actorUserId: string | null,
      supplyId: string,
      input: SupplyInput,
    ) => updateSupply(supplyRepository, { actorUserId, supplyId, input }),
    archive: (actorUserId: string | null, supplyId: string) =>
      archiveSupply(supplyRepository, { actorUserId, supplyId }),
  },
  products: {
    /** Technical length safeguards; the domain enforces them authoritatively. */
    limits: productLimits,
    listActive: () => listActiveProducts(productRepository),
    listCategories: () => listProductCategories(productRepository),
    listActiveSupplies: () => listProductSupplies(productRepository),
    listBundleProducts: () => listBundleProducts(productRepository),
    getEditable: async (productId: string): Promise<EditableProduct | null> => {
      const product = await getActiveProduct(productRepository, productId);
      if (!product) return null;
      const { id, categoryId } = product;
      return { id, categoryId, input: Product.toInput(product) };
    },
    create: (
      actorUserId: string | null,
      categoryId: string,
      input: ProductInput,
    ) => createProduct(productRepository, { actorUserId, categoryId, input }),
    update: (
      actorUserId: string | null,
      productId: string,
      categoryId: string,
      input: ProductInput,
    ) =>
      updateProduct(productRepository, {
        actorUserId,
        productId,
        categoryId,
        input,
      }),
    archive: (actorUserId: string | null, productId: string) =>
      archiveProduct(productRepository, { actorUserId, productId }),
  },
} as const;
