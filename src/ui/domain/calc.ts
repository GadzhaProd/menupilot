/**
 * Typed entry point to the calculation core. Screens import formatters and
 * calc functions from here, never from src/calc directly, and never
 * re-implement a formula.
 */
import { metrics, recipeCost } from '@/calc/costing.js';
import type { Dish, MenuDocument, MetricsStatus } from './types';

export { formatEURFromCents, formatEURFromMicro, parseMoneyToCents } from '@/calc/money.js';
export {
  batchCostMicro,
  ingredientLineCostMicro,
  metrics,
  netPriceMicro,
  packUnitPriceDisplay,
  packUnitPriceCents,
  prepLineCostMicro,
  prepUnitCostDisplay,
  prepUnitCostCents,
  recipeCost,
  selectPriceAtDate,
} from '@/calc/costing.js';
export { normalizeUnit, parseQuantityToMilli, unitPriceSuffix } from '@/calc/units.js';
export { compare, createBaselineSnapshot, isBaselineStale, simulate } from '@/calc/simulate.js';

/** One derived dish row for screens. BigInt fields stay in memory and are never serialized. */
export interface DishRow {
  id: string;
  name: string;
  menuPriceInclVatCents: number;
  status: MetricsStatus | 'error';
  /** Menu price excl. VAT, micro-euros (null when the row could not be calculated). */
  priceExclVatMicro: bigint | null;
  /** Recipe-based ingredient cost per portion; null = cost unknown. */
  costPerPortionMicro: bigint | null;
  /** Contribution before other costs; null = cost unknown. */
  contributionMicro: bigint | null;
  /** Food cost percentage based on the price excl. VAT, in tenths of a percent. */
  foodCostTenthsPct: bigint | null;
  error?: string;
}

function dishRow(dish: Dish, data: Pick<MenuDocument, 'ingredients' | 'recipes'>, asOf?: string): DishRow {
  try {
    const cost = recipeCost(dish, data, asOf === undefined ? undefined : { asOf });
    const result = metrics({
      recipeCostPerPortionMicro: cost.costPerPortionMicro,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      vatRateBp: dish.vatRateBp,
      monthlyVolume: dish.monthlyVolume ?? null,
    });
    return {
      id: dish.id,
      name: dish.name,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      status: result.status,
      priceExclVatMicro: result.priceExclVatMicro,
      costPerPortionMicro: result.recipeCostPerPortionMicro,
      contributionMicro: result.contributionMicro,
      foodCostTenthsPct: result.foodCostTenthsPct,
    };
  } catch (error) {
    return {
      id: dish.id,
      name: dish.name,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      status: 'error',
      priceExclVatMicro: null,
      costPerPortionMicro: null,
      contributionMicro: null,
      foodCostTenthsPct: null,
      error: error instanceof Error ? error.message : 'Calculation failed.',
    };
  }
}

/** Cost and contribution of every dish, using prices at `asOf` (default: latest prices). */
export function dishRows(data: Pick<MenuDocument, 'ingredients' | 'recipes'>, asOf?: string): DishRow[] {
  return data.recipes
    .filter((recipe): recipe is Dish => recipe.kind === 'dish')
    .map((dish) => dishRow(dish, data, asOf));
}

export { normalizeLocale, formatEURFromCentsLocale, formatEURFromMicroLocale, formatPercentTenthsLocale, formatPointsLocale, formatDateLocale } from '@/calc/money.js';
