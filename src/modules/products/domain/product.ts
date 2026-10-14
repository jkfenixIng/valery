import { err, ok, type Result } from '../../../shared/domain/Result';
import { Quantity } from '../../pricing/domain/quantity';

export const calculationTypes = [
  'recipe',
  'base_with_extras',
  'bundle',
  'fixed_price',
] as const;

export type CalculationType = (typeof calculationTypes)[number];
export type ComponentKind = 'supply' | 'product';
export type OptionSelection = 'single' | 'multiple';

/**
 * Technical safeguards against oversized input, not business rules.
 * The domain enforces them authoritatively; the form mirrors them.
 */
export const productLimits = {
  nameMaxLength: 120,
  descriptionMaxLength: 1000,
  optionNameMaxLength: 80,
  maxLaborMinutes: 100_000,
  maxYieldPortions: 10_000,
} as const;

/** Editable text form; quantities stay text until `Quantity.parse`. */
export type ComponentInput = Readonly<{
  kind: ComponentKind;
  referenceId: string;
  quantity: string;
}>;

export type OptionValueComponentInput = Readonly<{
  supplyId: string;
  quantity: string;
}>;

export type OptionValueInput = Readonly<{
  name: string;
  extraMaterialCostCop: number;
  extraLaborMinutes: number;
  suggestedExtraPriceCop: number | null;
  components: readonly OptionValueComponentInput[];
}>;

export type OptionGroupInput = Readonly<{
  name: string;
  selection: OptionSelection;
  required: boolean;
  visible: boolean;
  values: readonly OptionValueInput[];
}>;

export type ProductInput = Readonly<{
  name: string;
  description: string;
  calculationType: CalculationType;
  baseLaborMinutes: number;
  ownMarginBps: number | null;
  recipeYieldPortions: number | null;
  fixedPriceCop: number | null;
  isPublished: boolean;
  components: readonly ComponentInput[];
  optionGroups: readonly OptionGroupInput[];
}>;

type WithQuantity<T> = Omit<T, 'quantity'> & Readonly<{ quantity: Quantity }>;

export type ProductComponent = WithQuantity<ComponentInput>;
export type OptionValueComponent = WithQuantity<OptionValueComponentInput>;
export type OptionValue = Omit<OptionValueInput, 'components'> &
  Readonly<{ components: readonly OptionValueComponent[] }>;
export type OptionGroup = Omit<OptionGroupInput, 'values'> &
  Readonly<{ values: readonly OptionValue[] }>;

/** Validated product: trimmed text and exact, normalized quantities. */
export type ProductDetails = Omit<ProductInput, 'components' | 'optionGroups'> &
  Readonly<{
    components: readonly ProductComponent[];
    optionGroups: readonly OptionGroup[];
  }>;

export type ProductInvalid = Readonly<{
  code: 'PRODUCT_INVALID';
  fields: readonly string[];
}>;

type TypeRule = Readonly<{
  componentKinds: readonly ComponentKind[];
  components: 'required' | 'optional' | 'forbidden';
  optionGroups: boolean;
  recipeYield: boolean;
  fixedPrice: boolean;
}>;

const rules: Readonly<Record<CalculationType, TypeRule>> = {
  recipe: {
    componentKinds: ['supply'],
    components: 'required',
    optionGroups: false,
    recipeYield: true,
    fixedPrice: false,
  },
  base_with_extras: {
    componentKinds: ['supply'],
    components: 'optional',
    optionGroups: true,
    recipeYield: false,
    fixedPrice: false,
  },
  bundle: {
    componentKinds: ['supply', 'product'],
    components: 'required',
    optionGroups: false,
    recipeYield: false,
    fixedPrice: false,
  },
  fixed_price: {
    componentKinds: [],
    components: 'forbidden',
    optionGroups: false,
    recipeYield: false,
    fixedPrice: true,
  },
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isProductReference = (value: string): boolean =>
  uuidPattern.test(value);

const isBoundedText = (value: string, maxLength: number) =>
  value.length > 0 && value.length <= maxLength;

const isWholeInRange = (value: number, min: number, max: number) =>
  Number.isSafeInteger(value) && value >= min && value <= max;

const isMoney = (value: number) =>
  isWholeInRange(value, 0, Number.MAX_SAFE_INTEGER);

/** Collects invalid field paths while building validated values. */
class Violations {
  readonly fields: string[] = [];

  check(valid: boolean, field: string): void {
    if (!valid) this.fields.push(field);
  }

  quantity(text: string, field: string): Quantity | undefined {
    const parsed = Quantity.parse(text);
    this.check(parsed.ok, field);
    return parsed.ok ? parsed.value : undefined;
  }
}

const unique = () => {
  const seen = new Set<string>();
  return (key: string) => !seen.has(key) && Boolean(seen.add(key));
};

const productComponents = (
  input: ProductInput,
  rule: TypeRule,
  violations: Violations,
): ProductComponent[] => {
  const empty = input.components.length === 0;
  if (
    rule.components === 'forbidden' ||
    (rule.components === 'required' && empty)
  ) {
    violations.check(empty && rule.components === 'forbidden', 'components');
    return [];
  }

  const isNew = unique();
  return input.components.flatMap((component, index) => {
    const path = `components.${index}`;
    violations.check(
      rule.componentKinds.includes(component.kind),
      `${path}.kind`,
    );
    violations.check(
      isProductReference(component.referenceId) &&
        isNew(`${component.kind}:${component.referenceId.toLowerCase()}`),
      `${path}.referenceId`,
    );
    const quantity = violations.quantity(
      component.quantity,
      `${path}.quantity`,
    );
    return quantity ? [{ ...component, quantity }] : [];
  });
};

const optionValueComponents = (
  value: OptionValueInput,
  path: string,
  violations: Violations,
): OptionValueComponent[] => {
  const isNew = unique();
  return value.components.flatMap((component, index) => {
    const at = `${path}.components.${index}`;
    violations.check(
      isProductReference(component.supplyId) &&
        isNew(component.supplyId.toLowerCase()),
      `${at}.supplyId`,
    );
    const quantity = violations.quantity(component.quantity, `${at}.quantity`);
    return quantity ? [{ supplyId: component.supplyId, quantity }] : [];
  });
};

const optionValue = (
  value: OptionValueInput,
  path: string,
  isNewName: (name: string) => boolean,
  violations: Violations,
): OptionValue => {
  const name = value.name.trim();
  const { maxLaborMinutes, optionNameMaxLength } = productLimits;
  violations.check(
    isBoundedText(name, optionNameMaxLength) && isNewName(name),
    `${path}.name`,
  );
  violations.check(
    isMoney(value.extraMaterialCostCop),
    `${path}.extraMaterialCostCop`,
  );
  violations.check(
    isWholeInRange(value.extraLaborMinutes, 0, maxLaborMinutes),
    `${path}.extraLaborMinutes`,
  );
  violations.check(
    value.suggestedExtraPriceCop === null ||
      isMoney(value.suggestedExtraPriceCop),
    `${path}.suggestedExtraPriceCop`,
  );
  return {
    ...value,
    name,
    components: optionValueComponents(value, path, violations),
  };
};

const optionGroups = (
  input: ProductInput,
  rule: TypeRule,
  violations: Violations,
): OptionGroup[] => {
  if (!rule.optionGroups) {
    violations.check(input.optionGroups.length === 0, 'optionGroups');
    return [];
  }

  const isNewGroup = unique();
  return input.optionGroups.map((group, index) => {
    const path = `optionGroups.${index}`;
    const name = group.name.trim();
    violations.check(
      isBoundedText(name, productLimits.optionNameMaxLength) &&
        isNewGroup(name),
      `${path}.name`,
    );
    violations.check(group.values.length > 0, `${path}.values`);
    const isNewValue = unique();
    const values = group.values.map((value, valueIndex) =>
      optionValue(
        value,
        `${path}.values.${valueIndex}`,
        isNewValue,
        violations,
      ),
    );
    return { ...group, name, values };
  });
};

const checkScalars = (
  input: ProductInput,
  rule: TypeRule,
  violations: Violations,
) => {
  const { descriptionMaxLength, maxLaborMinutes, maxYieldPortions } =
    productLimits;
  violations.check(
    isBoundedText(input.name.trim(), productLimits.nameMaxLength),
    'name',
  );
  violations.check(
    isBoundedText(input.description.trim(), descriptionMaxLength),
    'description',
  );
  violations.check(
    calculationTypes.includes(input.calculationType),
    'calculationType',
  );
  violations.check(
    isWholeInRange(input.baseLaborMinutes, 0, maxLaborMinutes),
    'baseLaborMinutes',
  );
  violations.check(
    input.ownMarginBps === null || isWholeInRange(input.ownMarginBps, 0, 9_999),
    'ownMarginBps',
  );
  // Recipe yield is a whole number of portions; fractional yields are invalid.
  violations.check(
    rule.recipeYield
      ? input.recipeYieldPortions !== null &&
          isWholeInRange(input.recipeYieldPortions, 1, maxYieldPortions)
      : input.recipeYieldPortions === null,
    'recipeYieldPortions',
  );
  violations.check(
    rule.fixedPrice
      ? input.fixedPriceCop !== null &&
          isWholeInRange(input.fixedPriceCop, 1, Number.MAX_SAFE_INTEGER)
      : input.fixedPriceCop === null,
    'fixedPriceCop',
  );
};

export const Product = {
  create(input: ProductInput): Result<ProductDetails, ProductInvalid> {
    const rule = rules[input.calculationType] ?? rules.fixed_price;
    const violations = new Violations();

    checkScalars(input, rule, violations);
    const components = productComponents(input, rule, violations);
    const groups = optionGroups(input, rule, violations);

    if (violations.fields.length > 0) {
      return err({ code: 'PRODUCT_INVALID', fields: violations.fields });
    }
    return ok({
      ...input,
      name: input.name.trim(),
      description: input.description.trim(),
      components,
      optionGroups: groups,
    });
  },

  /** Editable text form of validated details; quantities stay canonical. */
  toInput(details: ProductDetails): ProductInput {
    return {
      ...details,
      components: details.components.map((component) => ({
        ...component,
        quantity: component.quantity.toString(),
      })),
      optionGroups: details.optionGroups.map((group) => ({
        ...group,
        values: group.values.map((value) => ({
          ...value,
          components: value.components.map((component) => ({
            ...component,
            quantity: component.quantity.toString(),
          })),
        })),
      })),
    };
  },
} as const;
