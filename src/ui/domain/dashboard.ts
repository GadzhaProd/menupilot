import {
  batchCostMicro,
  metrics,
  prepUnitCostDisplay,
  recipeCost,
  selectPriceAtDate,
} from './calc';
import type { Dish, MenuDocument, Prep, Recipe } from './types';

type Catalog = Pick<MenuDocument, 'ingredients' | 'recipes'>;

export type DashboardStatus =
  | 'ready'
  | 'cost-unknown'
  | 'no-price-on-date'
  | 'error';

export interface DashboardDishRow {
  id: string;
  name: string;
  menuPriceInclVatCents: number;
  priceExclVatMicro: bigint | null;
  currentCostMicro: bigint | null;
  comparisonCostMicro: bigint | null;
  currentContributionMicro: bigint | null;
  currentFoodCostTenthsPct: bigint | null;
  costDeltaMicro: bigint | null;
  foodCostDeltaTenthsPct: bigint | null;
  monthlyImpactCents: bigint | null;
  status: DashboardStatus;
  monthlyVolume: number | null;
}

export interface DashboardPrepRow {
  id: string;
  name: string;
  current: string | null;
  comparison: string | null;
  noPriceOnDate: boolean;
}

export interface DashboardData {
  dishes: DashboardDishRow[];
  preps: DashboardPrepRow[];
  totalMonthlyImpactCents: bigint | null;
  excludedWithoutVolume: number;
  gotMoreExpensive: number;
  averageFoodCostTenthsPct: bigint | null;
}

function recipeUsesMissingPrice(
  recipe: Recipe,
  catalog: Catalog,
  asOf: string,
  visited = new Set<string>(),
): boolean {
  if (visited.has(recipe.id)) return false;
  visited.add(recipe.id);

  return recipe.lines.some((line) => {
    if (line.ref.kind === 'ingredient') {
      const ingredient = catalog.ingredients.find(
        (entry) => entry.id === line.ref.id,
      );
      return !ingredient || selectPriceAtDate(ingredient.prices, asOf) === null;
    }

    const prep = catalog.recipes.find(
      (entry) => entry.id === line.ref.id && entry.kind === 'prep',
    );
    return !prep || recipeUsesMissingPrice(prep, catalog, asOf, visited);
  });
}

function dishStatus(
  missingPrice: boolean,
  currentStatus: string,
  historicalStatus: string,
): DashboardStatus {
  if (missingPrice) return 'no-price-on-date';
  if (currentStatus === 'cost-unknown' || historicalStatus === 'cost-unknown') {
    return 'cost-unknown';
  }
  return 'ready';
}

function makeDishRow(dish: Dish, catalog: Catalog, asOf: string): DashboardDishRow {
  const missingPrice = recipeUsesMissingPrice(dish, catalog, asOf);
  const commonMetrics = {
    menuPriceInclVatCents: dish.menuPriceInclVatCents,
    vatRateBp: dish.vatRateBp,
    monthlyVolume: dish.monthlyVolume ?? null,
  };

  try {
    const currentCost = recipeCost(dish, catalog).costPerPortionMicro;
    const historicalCost = recipeCost(dish, catalog, { asOf }).costPerPortionMicro;
    const current = metrics({
      recipeCostPerPortionMicro: currentCost,
      ...commonMetrics,
    });
    const historical = metrics({
      recipeCostPerPortionMicro: historicalCost,
      ...commonMetrics,
    });

    const monthlyImpactCents =
      dish.monthlyVolume == null ||
      current.monthlyContributionCents === null ||
      historical.monthlyContributionCents === null
        ? null
        : current.monthlyContributionCents - historical.monthlyContributionCents;

    return {
      id: dish.id,
      name: dish.name,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      priceExclVatMicro: current.priceExclVatMicro,
      currentCostMicro: current.recipeCostPerPortionMicro,
      comparisonCostMicro: historical.recipeCostPerPortionMicro,
      currentContributionMicro: current.contributionMicro,
      currentFoodCostTenthsPct: current.foodCostTenthsPct,
      costDeltaMicro: difference(current.recipeCostPerPortionMicro, historical.recipeCostPerPortionMicro),
      foodCostDeltaTenthsPct: difference(current.foodCostTenthsPct, historical.foodCostTenthsPct),
      monthlyImpactCents,
      status: dishStatus(missingPrice, current.status, historical.status),
      monthlyVolume: dish.monthlyVolume ?? null,
    };
  } catch {
    return {
      id: dish.id,
      name: dish.name,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      priceExclVatMicro: null,
      currentCostMicro: null,
      comparisonCostMicro: null,
      currentContributionMicro: null,
      currentFoodCostTenthsPct: null,
      costDeltaMicro: null,
      foodCostDeltaTenthsPct: null,
      monthlyImpactCents: null,
      status: 'error',
      monthlyVolume: dish.monthlyVolume ?? null,
    };
  }
}

function difference(current: bigint | null, historical: bigint | null): bigint | null {
  return current === null || historical === null ? null : current - historical;
}

function makePrepRow(prep: Prep, catalog: Catalog, asOf: string): DashboardPrepRow {
  const currentBatchCost = batchCostMicro(prep, catalog);
  const noPriceOnDate = recipeUsesMissingPrice(prep, catalog, asOf);
  const historicalBatchCost = noPriceOnDate
    ? null
    : batchCostMicro(prep, catalog, { asOf });

  return {
    id: prep.id,
    name: prep.name,
    current: prepUnitCostDisplay(currentBatchCost, prep.outputMilli, prep.outputUnit),
    comparison: noPriceOnDate
      ? null
      : prepUnitCostDisplay(historicalBatchCost, prep.outputMilli, prep.outputUnit),
    noPriceOnDate,
  };
}

function averageFoodCost(rows: readonly DashboardDishRow[]): bigint | null {
  const values = rows.flatMap((row) =>
    row.currentFoodCostTenthsPct === null ? [] : [row.currentFoodCostTenthsPct],
  );
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0n) / BigInt(values.length);
}

export function dashboardData(data: Catalog, asOf: string): DashboardData {
  const dishes = data.recipes
    .filter((recipe): recipe is Dish => recipe.kind === 'dish')
    .map((dish) => makeDishRow(dish, data, asOf));
  const preps = data.recipes
    .filter((recipe): recipe is Prep => recipe.kind === 'prep')
    .map((prep) => makePrepRow(prep, data, asOf));
  const knownImpacts = dishes.flatMap((row) =>
    row.monthlyImpactCents === null ? [] : [row.monthlyImpactCents],
  );

  return {
    dishes,
    preps,
    totalMonthlyImpactCents: knownImpacts.length === 0
      ? null
      : knownImpacts.reduce((sum, value) => sum + value, 0n),
    excludedWithoutVolume: dishes.filter((row) => row.monthlyVolume === null).length,
    gotMoreExpensive: dishes.filter(
      (row) => row.costDeltaMicro !== null && row.costDeltaMicro > 0n,
    ).length,
    averageFoodCostTenthsPct: averageFoodCost(dishes),
  };
}
