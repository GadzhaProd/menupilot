import {
  batchCostMicro,
  metrics,
  prepUnitCostDisplay,
  recipeCost,
  selectPriceAtDate,
} from './calc';
import {
  averageFoodCostTenths,
  costChangeCents,
  foodCostChangeTenths,
  menuMonthlyImpactCents,
  monthlyImpactCents,
} from '@/calc/impact.js';
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
  costDeltaCents: bigint | null;
  foodCostDeltaTenthsPct: bigint | null;
  monthlyImpactCents: bigint | null;
  status: DashboardStatus;
  monthlyVolume: number | null;
}

export interface DashboardPrepRow {
  id: string;
  name: string;
  current: string | null;
  currentBatchMicro: bigint | null;
  comparisonBatchMicro: bigint | null;
  outputMilli: number;
  outputUnit: Prep['outputUnit'];
  comparison: string | null;
  noPriceOnDate: boolean;
  costUnknown: boolean;
}

export interface DashboardData {
  dishes: DashboardDishRow[];
  preps: DashboardPrepRow[];
  totalMonthlyImpactCents: bigint | null;
  excludedWithoutVolume: number;
  excludedWithVolume: number;
  gotMoreExpensive: number;
  averageFoodCostTenthsPct: bigint | null;
}

type PriceIssue = 'cost-unknown' | 'no-price-on-date' | null;

function recipePriceIssue(
  recipe: Recipe,
  catalog: Catalog,
  asOf: string,
  visited = new Set<string>(),
): PriceIssue {
  if (visited.has(recipe.id)) return null;
  visited.add(recipe.id);

  for (const line of recipe.lines) {
    if (line.ref.kind === 'ingredient') {
      const ingredient = catalog.ingredients.find(
        (entry) => entry.id === line.ref.id,
      );
      if (!ingredient || ingredient.prices.length === 0) return 'cost-unknown';
      if (selectPriceAtDate(ingredient.prices, asOf) === null) {
        return 'no-price-on-date';
      }
      continue;
    }

    const prep = catalog.recipes.find(
      (entry) => entry.id === line.ref.id && entry.kind === 'prep',
    );
    if (!prep) return 'cost-unknown';
    const issue = recipePriceIssue(prep, catalog, asOf, visited);
    if (issue !== null) return issue;
  }
  return null;
}

function dishStatus(
  priceIssue: PriceIssue,
  currentStatus: string,
  historicalStatus: string,
): DashboardStatus {
  if (priceIssue !== null) return priceIssue;
  if (currentStatus === 'cost-unknown' || historicalStatus === 'cost-unknown') {
    return 'cost-unknown';
  }
  return 'ready';
}

function makeDishRow(dish: Dish, catalog: Catalog, asOf: string): DashboardDishRow {
  const priceIssue = recipePriceIssue(dish, catalog, asOf);
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

    const monthlyImpact =
      dish.monthlyVolume == null
        ? null
        : monthlyImpactCents(
          current.monthlyContributionCents,
          historical.monthlyContributionCents,
        );

    return {
      id: dish.id,
      name: dish.name,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      priceExclVatMicro: current.priceExclVatMicro,
      currentCostMicro: current.recipeCostPerPortionMicro,
      comparisonCostMicro: historical.recipeCostPerPortionMicro,
      currentContributionMicro: current.contributionMicro,
      currentFoodCostTenthsPct: current.foodCostTenthsPct,
      costDeltaCents: costChangeCents(
        current.recipeCostPerPortionMicro,
        historical.recipeCostPerPortionMicro,
      ),
      foodCostDeltaTenthsPct: foodCostChangeTenths(
        current.foodCostTenthsPct,
        historical.foodCostTenthsPct,
      ),
      monthlyImpactCents: monthlyImpact,
      status: dishStatus(priceIssue, current.status, historical.status),
      monthlyVolume: dish.monthlyVolume ?? null,
    };
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof RangeError)) throw error;
    return {
      id: dish.id,
      name: dish.name,
      menuPriceInclVatCents: dish.menuPriceInclVatCents,
      priceExclVatMicro: null,
      currentCostMicro: null,
      comparisonCostMicro: null,
      currentContributionMicro: null,
      currentFoodCostTenthsPct: null,
      costDeltaCents: null,
      foodCostDeltaTenthsPct: null,
      monthlyImpactCents: null,
      status: 'error',
      monthlyVolume: dish.monthlyVolume ?? null,
    };
  }
}

function makePrepRow(prep: Prep, catalog: Catalog, asOf: string): DashboardPrepRow {
  const priceIssue = recipePriceIssue(prep, catalog, asOf);
  const costUnknown = priceIssue === 'cost-unknown';
  const noPriceOnDate = priceIssue === 'no-price-on-date';
  const currentBatchCost = costUnknown ? null : batchCostMicro(prep, catalog);
  const historicalBatchCost = priceIssue !== null
    ? null
    : batchCostMicro(prep, catalog, { asOf });

  return {
    id: prep.id,
    name: prep.name,
    currentBatchMicro: currentBatchCost,
    comparisonBatchMicro: historicalBatchCost,
    outputMilli: prep.outputMilli,
    outputUnit: prep.outputUnit,
    current: prepUnitCostDisplay(currentBatchCost, prep.outputMilli, prep.outputUnit),
    comparison: noPriceOnDate
      ? null
      : prepUnitCostDisplay(historicalBatchCost, prep.outputMilli, prep.outputUnit),
    noPriceOnDate,
    costUnknown,
  };
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
  const dishesWithVolume = dishes.filter((row) => row.monthlyVolume !== null);
  const excludedWithVolumeRows = dishesWithVolume.filter(
    (row) => row.monthlyImpactCents === null,
  );


  return {
    dishes,
    preps,
    totalMonthlyImpactCents: dishesWithVolume.length === 0
      ? null
      : menuMonthlyImpactCents(knownImpacts),
    excludedWithoutVolume: dishes.filter((row) => row.monthlyVolume === null).length,
    excludedWithVolume: excludedWithVolumeRows.length,
    gotMoreExpensive: dishes.filter(
      (row) => row.costDeltaCents !== null && row.costDeltaCents > 0n,
    ).length,
    averageFoodCostTenthsPct: averageFoodCostTenths(
      dishes.flatMap((row) => row.currentFoodCostTenthsPct === null
        ? []
        : [row.currentFoodCostTenthsPct]),
    ),
  };
}

/** Rank comparable, positive per-portion cost changes; document order breaks ties. No new arithmetic. */
export function largestCostIncrease(rows: readonly DashboardDishRow[]) {
  let dish: DashboardDishRow | null = null;
  let tied = false;
  for (const row of rows) {
    if (row.status !== 'ready' || row.costDeltaCents === null || row.costDeltaCents <= 0n) continue;
    if (dish === null || row.costDeltaCents > dish.costDeltaCents!) { dish = row; tied = false; }
    else if (row.costDeltaCents === dish.costDeltaCents) tied = true;
  }
  return dish === null ? null : { dish, tied };
}
