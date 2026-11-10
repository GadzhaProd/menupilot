import { batchCostMicro, metrics, prepUnitCostDisplay, recipeCost, selectPriceAtDate } from './costing.js';
import { averageFoodCostTenths, costChangeCents, foodCostChangeTenths, menuMonthlyImpactCents, monthlyImpactCents } from './impact.js';

function recipePriceIssues(recipe, catalog, asOf) {
  const visited = new Set();
  const missing = new Map();
  let issue = null;
  function visit(current) {
    if (visited.has(current.id)) return;
    visited.add(current.id);
    for (const line of current.lines) {
      if (line.ref.kind === 'ingredient') {
        const ingredient = catalog.ingredients.find(entry => entry.id === line.ref.id);
        if (!ingredient) { issue ??= 'cost-unknown'; continue; }
        if (selectPriceAtDate(ingredient.prices, asOf) === null) {
          issue ??= ingredient.prices.length === 0 ? 'cost-unknown' : 'no-price-on-date';
          missing.set(ingredient.id, { id: ingredient.id, name: ingredient.name });
        }
      } else {
        const prep = catalog.recipes.find(entry => entry.id === line.ref.id && entry.kind === 'prep');
        if (prep) visit(prep);
        else issue ??= 'cost-unknown';
      }
    }
  }
  visit(recipe);
  return { issue, missingPrices: [...missing.values()] };
}

function makeDishRow(dish, catalog, asOf) {
  const { issue: priceIssue, missingPrices } = recipePriceIssues(dish, catalog, asOf);
  const commonMetrics = { menuPriceInclVatCents: dish.menuPriceInclVatCents, vatRateBp: dish.vatRateBp, monthlyVolume: dish.monthlyVolume ?? null };
  try {
    const current = metrics({ recipeCostPerPortionMicro: recipeCost(dish, catalog).costPerPortionMicro, ...commonMetrics });
    const historical = metrics({ recipeCostPerPortionMicro: recipeCost(dish, catalog, { asOf }).costPerPortionMicro, ...commonMetrics });
    const monthlyImpact = dish.monthlyVolume == null ? null : monthlyImpactCents(current.monthlyContributionCents, historical.monthlyContributionCents);
    return {
      id: dish.id, name: dish.name, menuPriceInclVatCents: dish.menuPriceInclVatCents,
      priceExclVatMicro: current.priceExclVatMicro, currentCostMicro: current.recipeCostPerPortionMicro,
      comparisonCostMicro: historical.recipeCostPerPortionMicro, currentContributionMicro: current.contributionMicro,
      currentFoodCostTenthsPct: current.foodCostTenthsPct,
      costDeltaCents: costChangeCents(current.recipeCostPerPortionMicro, historical.recipeCostPerPortionMicro),
      foodCostDeltaTenthsPct: foodCostChangeTenths(current.foodCostTenthsPct, historical.foodCostTenthsPct),
      monthlyImpactCents: monthlyImpact,
      status: priceIssue ?? ((current.status === 'cost-unknown' || historical.status === 'cost-unknown') ? 'cost-unknown' : 'ready'),
      monthlyVolume: dish.monthlyVolume ?? null, missingPrices,
    };
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof RangeError)) throw error;
    return { id: dish.id, name: dish.name, menuPriceInclVatCents: dish.menuPriceInclVatCents,
      priceExclVatMicro: null, currentCostMicro: null, comparisonCostMicro: null, currentContributionMicro: null,
      currentFoodCostTenthsPct: null, costDeltaCents: null, foodCostDeltaTenthsPct: null, monthlyImpactCents: null,
      status: 'error', monthlyVolume: dish.monthlyVolume ?? null, missingPrices };
  }
}

function makePrepRow(prep, catalog, asOf) {
  const { issue } = recipePriceIssues(prep, catalog, asOf);
  const costUnknown = issue === 'cost-unknown', noPriceOnDate = issue === 'no-price-on-date';
  const currentBatchCost = costUnknown ? null : batchCostMicro(prep, catalog);
  const historicalBatchCost = issue !== null ? null : batchCostMicro(prep, catalog, { asOf });
  return { id: prep.id, name: prep.name, currentBatchMicro: currentBatchCost, comparisonBatchMicro: historicalBatchCost,
    outputMilli: prep.outputMilli, outputUnit: prep.outputUnit,
    current: prepUnitCostDisplay(currentBatchCost, prep.outputMilli, prep.outputUnit),
    comparison: noPriceOnDate ? null : prepUnitCostDisplay(historicalBatchCost, prep.outputMilli, prep.outputUnit), noPriceOnDate, costUnknown };
}

/** Dashboard calculation shared by the UI and local CLI. Results retain BigInt fields. */
export function dashboardData(data, asOf) {
  const dishes = data.recipes.filter(recipe => recipe.kind === 'dish').map(dish => makeDishRow(dish, data, asOf));
  const preps = data.recipes.filter(recipe => recipe.kind === 'prep').map(prep => makePrepRow(prep, data, asOf));
  const knownImpacts = dishes.flatMap(row => row.monthlyImpactCents === null ? [] : [row.monthlyImpactCents]);
  const dishesWithVolume = dishes.filter(row => row.monthlyVolume !== null);
  return {
    dishes, preps,
    totalMonthlyImpactCents: dishesWithVolume.length === 0 ? null : menuMonthlyImpactCents(knownImpacts),
    excludedWithoutVolume: dishes.filter(row => row.monthlyVolume === null).length,
    excludedWithVolume: dishesWithVolume.filter(row => row.monthlyImpactCents === null).length,
    gotMoreExpensive: dishes.filter(row => row.costDeltaCents !== null && row.costDeltaCents > 0n).length,
    averageFoodCostTenthsPct: averageFoodCostTenths(dishes.flatMap(row => row.currentFoodCostTenthsPct === null ? [] : [row.currentFoodCostTenthsPct])),
  };
}
