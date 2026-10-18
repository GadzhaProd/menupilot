/**
 * Typed entry point to the calculation core. Screens import formatters and
 * calc functions from here, never from src/calc directly, and never
 * re-implement a formula.
 */
import { metrics, recipeCost } from '@/calc/costing.js';
import type { Dish, MenuDocument, MetricsStatus } from './types';

export { formatEURFromCents, formatEURFromMicro, parseMoneyToCents } from '@/calc/money.js';
export {
  metrics,
  netPriceMicro,
  packUnitPriceDisplay,
  prepUnitCostDisplay,
  recipeCost,
  selectPriceAtDate,
} from '@/calc/costing.js';
export { normalizeUnit, parseQuantityToMilli, unitPriceSuffix } from '@/calc/units.js';
export { compare, createBaselineSnapshot, isBaselineStale, simulate } from '@/calc/simulate.js';

/** One dish on the Dashboard. BigInt fields are derived: keep them in memory only. */
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
