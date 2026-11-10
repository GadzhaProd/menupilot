import { dashboardData } from './dashboard.js';
import { monthlyContributionCents } from './costing.js';
import {
  costChangeCents,
  foodCostChangeTenths,
  monthlyImpactCents,
  menuMonthlyImpactCents
} from './impact.js';

/** Compose existing costing and impact functions for simultaneous supplier changes. */
export function proposalEffects(before, after, ingredientIds, timestamp) {
  const changed = new Set(ingredientIds);
  const affected = new Set();
  const memo = new Map();
  const byId = new Map(before.recipes.map(r => [r.id, r]));
  function uses(recipe) {
    if (memo.has(recipe.id)) {
      return memo.get(recipe.id);
    }
    const found = recipe.lines.some(
      ({ ref }) => ref.kind === 'ingredient'
        ? changed.has(ref.id)
        : uses(
          byId.get(
            ref.id
          )
        )
    );
    memo.set(recipe.id, found);
    if (found) {
      affected.add(recipe.id);
    }
    return found;
  }
  before.recipes.forEach(uses);
  const previous = dashboardData(before, timestamp);
  const next = dashboardData(after, timestamp);
  const dishes = next.dishes.filter(row => affected.has(row.id)).map(row => {
    const old = previous.dishes.find(r => r.id === row.id);
    const monthly = r => r.monthlyVolume === null || r.currentContributionMicro === null
      ? null
      : monthlyContributionCents(
        r.currentContributionMicro,
        r.monthlyVolume
      );
    const impact = monthlyImpactCents(monthly(row), monthly(old));
    return {
      ...row,
      comparisonCostMicro: old.currentCostMicro,
      comparisonFoodCostTenthsPct: old.currentFoodCostTenthsPct,
      costDeltaCents: costChangeCents(row.currentCostMicro, old.currentCostMicro),
      foodCostDeltaTenthsPct: foodCostChangeTenths(row.currentFoodCostTenthsPct, old.currentFoodCostTenthsPct),
      monthlyImpactCents: impact,
      excludedReason: row.monthlyVolume === null ? 'no-volume' : impact === null ? 'cost-unknown' : null
    };
  });
  const preps = next.preps.filter(row => affected.has(row.id)).map(row => {
    const old = previous.preps.find(r => r.id === row.id);
    return { ...row, comparisonBatchMicro: old.currentBatchMicro, comparison: old.current };
  });
  return {
    dishes,
    preps,
    totalMonthlyImpactCents: dishes.some(row => row.monthlyVolume !== null) ? menuMonthlyImpactCents(
        dishes.map(row => row.monthlyImpactCents)
      ) : null,
    excludedWithoutVolume: dishes.filter(row => row.monthlyVolume === null).length,
    excludedWithVolume: dishes.filter(row => row.monthlyVolume !== null && row.monthlyImpactCents === null).length
  };
}
