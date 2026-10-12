import { describe, expect, it } from 'vitest';

import {
  categories,
  productComponents,
  products,
  settings,
  supplies,
} from './schema';

describe('database schema', () => {
  it('defines the F0 persistence tables', () => {
    expect(
      Object.keys({
        settings,
        categories,
        supplies,
        products,
        productComponents,
      }),
    ).toEqual([
      'settings',
      'categories',
      'supplies',
      'products',
      'productComponents',
    ]);
  });
});
