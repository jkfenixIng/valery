/**
 * Field-name fragments that must never reach a public DTO. They cover the
 * persistence columns `supplies.unitCostCop` and `products.marginBps`, the
 * derived cost/profit values, and any inventory or stock level.
 */
export const PUBLIC_DTO_FORBIDDEN_FIELD_FRAGMENTS = [
  'cost',
  'margin',
  'profit',
  'inventory',
  'stock',
  'onhand',
] as const;

const normalizeFieldName = (name: string) =>
  name.toLowerCase().replace(/[^a-z]/g, '');

const isForbiddenFieldName = (name: string) => {
  const normalized = normalizeFieldName(name);

  return PUBLIC_DTO_FORBIDDEN_FIELD_FRAGMENTS.some((fragment) =>
    normalized.includes(fragment),
  );
};

const collectForbiddenPaths = (
  value: unknown,
  path: string,
  visited: WeakSet<object>,
): string[] => {
  if (typeof value !== 'object' || value === null || visited.has(value)) {
    return [];
  }

  visited.add(value);

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectForbiddenPaths(item, `${path}[${index}]`, visited),
    );
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = path ? `${path}.${key}` : key;
    const own = isForbiddenFieldName(key) ? [childPath] : [];

    return [...own, ...collectForbiddenPaths(child, childPath, visited)];
  });
};

/** Returns the path of every forbidden field found in a public payload. */
export const findForbiddenPublicFields = (dto: unknown): string[] =>
  collectForbiddenPaths(dto, '', new WeakSet());

/** Throws when a public payload exposes cost, margin, or inventory data. */
export const assertPublicDto = (dto: unknown): void => {
  const forbidden = findForbiddenPublicFields(dto);

  if (forbidden.length > 0) {
    throw new Error(
      `Public DTO exposes forbidden fields: ${forbidden.join(', ')}`,
    );
  }
};
