import { MICRO_EUROS_PER_CENT } from './constants.js';
import { roundDiv } from './money.js';

/** Difference between recipe costs after each amount is displayed in cents. */
export function costChangeCents(currentMicro, comparisonMicro) {
  if (currentMicro === null || comparisonMicro === null) return null;
  return roundDiv(currentMicro, MICRO_EUROS_PER_CENT)
    - roundDiv(comparisonMicro, MICRO_EUROS_PER_CENT);
}

/** Difference between already displayed food-cost tenths. */
export function foodCostChangeTenths(currentTenths, comparisonTenths) {
  if (currentTenths === null || comparisonTenths === null) return null;
  return currentTenths - comparisonTenths;
}

/** Monthly contribution now less monthly contribution at the comparison date. */
export function monthlyImpactCents(currentContribution, comparisonContribution) {
  if (currentContribution === null || comparisonContribution === null) return null;
  return currentContribution - comparisonContribution;
}

/** Sum known monthly impacts. Unknown impacts must be excluded by the caller. */
export function menuMonthlyImpactCents(knownImpacts) {
  return knownImpacts.reduce(
    (sum, impact) => impact === null ? sum : sum + impact,
    0n,
  );
}

/** Simple mean of displayed food-cost tenths, rounded half away from zero. */
export function averageFoodCostTenths(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((total, value) => total + value, 0n);
  return roundDiv(sum, BigInt(values.length));
}
