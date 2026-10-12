import { fileURLToPath } from 'node:url';

import { closeDatabase, database } from './client';
import {
  categories,
  productComponents,
  products,
  settings,
  supplies,
} from './schema';

export const seedIds = {
  settings: '11111111-1111-4111-8111-111111111111',
  cakes: '22222222-2222-4222-8222-222222222222',
  desserts: '33333333-3333-4333-8333-333333333333',
  supplies: {
    candle: '44444444-4444-4444-8444-444444444444',
    bag: '55555555-5555-4555-8555-555555555555',
  },
  products: {
    cake: '66666666-6666-4666-8666-666666666666',
    brownie: '77777777-7777-4777-8777-777777777777',
    giftBag: '88888888-8888-4888-888888888888',
  },
  components: {
    giftBagCandle: '99999999-9999-4999-8999-999999999999',
    giftBagBrownie: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  },
};

export const seedDatabase = async (
  databaseClient = database,
): Promise<void> => {
  await databaseClient.transaction(async (transaction) => {
    await transaction
      .insert(settings)
      .values({ id: seedIds.settings, key: 'business_name', value: 'Valery' })
      .onConflictDoUpdate({
        target: settings.key,
        set: { id: seedIds.settings, value: 'Valery' },
      });

    for (const category of [
      { id: seedIds.cakes, name: 'Tortas' },
      { id: seedIds.desserts, name: 'Postres' },
    ]) {
      await transaction
        .insert(categories)
        .values(category)
        .onConflictDoUpdate({
          target: categories.name,
          set: { id: category.id },
        });
    }

    for (const supply of [
      {
        id: seedIds.supplies.candle,
        categoryId: seedIds.desserts,
        name: 'Vela mediana',
        unit: 'unidad',
        unitCostCop: 1200n,
      },
      {
        id: seedIds.supplies.bag,
        categoryId: seedIds.desserts,
        name: 'Bolsa de regalo',
        unit: 'unidad',
        unitCostCop: 1800n,
      },
    ]) {
      await transaction
        .insert(supplies)
        .values(supply)
        .onConflictDoUpdate({
          target: [supplies.categoryId, supplies.name],
          set: {
            id: supply.id,
            categoryId: supply.categoryId,
            unit: supply.unit,
            unitCostCop: supply.unitCostCop,
          },
        });
    }

    for (const product of [
      {
        id: seedIds.products.cake,
        categoryId: seedIds.cakes,
        name: 'Torta',
        description: 'Torta de ejemplo.',
        salePriceCop: 75000n,
        marginBps: 3500,
      },
      {
        id: seedIds.products.brownie,
        categoryId: seedIds.desserts,
        name: 'Postre individual',
        description: 'Brownie individual.',
        salePriceCop: 8500n,
        marginBps: 4000,
      },
      {
        id: seedIds.products.giftBag,
        categoryId: seedIds.desserts,
        name: 'Bolsa de regalo',
        description: 'Bolsa con vela y brownie.',
        salePriceCop: 13000n,
        marginBps: 3000,
      },
    ]) {
      await transaction
        .insert(products)
        .values(product)
        .onConflictDoUpdate({
          target: [products.categoryId, products.name],
          set: {
            id: product.id,
            categoryId: product.categoryId,
            description: product.description,
            salePriceCop: product.salePriceCop,
            marginBps: product.marginBps,
          },
        });
    }

    for (const component of [
      {
        id: seedIds.components.giftBagCandle,
        productId: seedIds.products.giftBag,
        supplyId: seedIds.supplies.candle,
        componentProductId: null,
        quantity: '1.000',
      },
      {
        id: seedIds.components.giftBagBrownie,
        productId: seedIds.products.giftBag,
        supplyId: null,
        componentProductId: seedIds.products.brownie,
        quantity: '1.000',
      },
    ]) {
      await transaction
        .insert(productComponents)
        .values(component)
        .onConflictDoUpdate({
          target: productComponents.id,
          set: {
            id: component.id,
            productId: component.productId,
            supplyId: component.supplyId,
            componentProductId: component.componentProductId,
            quantity: component.quantity,
          },
        });
    }
  });
};

const run = async (): Promise<void> => {
  await seedDatabase();
  await closeDatabase();
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void run();
}
