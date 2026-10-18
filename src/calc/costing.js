import { formatEURFromCents, roundDiv } from './money.js';
import { normalizeUnit } from './units.js';
import { recipeBatchCostMicro } from './prep.js';
import { safeInteger } from './internal.js';

export { ingredientLineCostMicro, selectPriceAtDate } from './internal.js';
export { batchCostMicro, prepLineCostMicro, prepUnitCostDisplay } from './prep.js';

const BASIS_POINTS = 10_000n;
const MICRO_EUROS_PER_CENT = 10_000n;

/**
 * Calculate the menu price excluding VAT in micro-euros.
 * @param {number} menuPriceInclVatCents Safe integer cents including VAT.
 * @param {number} vatRateBp VAT rate in basis points.
 * @returns {bigint} Price excluding VAT in micro-euros.
 */
export function netPriceMicro(menuPriceInclVatCents, vatRateBp) {
  const grossCents = safeInteger(menuPriceInclVatCents, 'menuPriceInclVatCents', 0);
  const vatBasisPoints = safeInteger(vatRateBp, 'vatRateBp', 0);
  return roundDiv(grossCents * MICRO_EUROS_PER_CENT * BASIS_POINTS, BASIS_POINTS + vatBasisPoints);
}

/**
 * Calculate monthly contribution rounded once to integer euro cents.
 * @param {bigint} contributionMicro Contribution per portion in micro-euros.
 * @param {number} monthlyVolume Safe integer estimate of portions per month.
 * @returns {bigint} Monthly contribution in cents.
 */
export function monthlyContributionCents(contributionMicro, monthlyVolume) {
  if (typeof contributionMicro !== 'bigint') {
    throw new TypeError('Contribution must be a BigInt in micro-euros.');
  }
  const volume = safeInteger(monthlyVolume, 'monthlyVolume', 0);
  return roundDiv(contributionMicro * volume, MICRO_EUROS_PER_CENT);
}

/**
 * Calculate contribution and percentage metrics from recipe cost and menu price.
 * Percentages are rounded to tenths; null means unknown or not applicable.
 * @param {{recipeCostPerPortionMicro:bigint|null, menuPriceInclVatCents:number, vatRateBp:number, monthlyVolume?:number}} input
 * @returns {{priceExclVatMicro:bigint, recipeCostPerPortionMicro:bigint|null, contributionMicro:bigint|null, foodCostTenthsPct:bigint|null, contributionMarginTenthsPct:bigint|null, monthlyContributionCents:bigint|null}}
 */
export function metrics({ recipeCostPerPortionMicro, menuPriceInclVatCents, vatRateBp, monthlyVolume } = {}) {
  if (recipeCostPerPortionMicro !== null && typeof recipeCostPerPortionMicro !== 'bigint') {
    throw new TypeError('Recipe cost must be a BigInt in micro-euros or null.');
  }
  const priceExclVatMicro = netPriceMicro(menuPriceInclVatCents, vatRateBp);
  if (monthlyVolume !== undefined) {
    safeInteger(monthlyVolume, 'monthlyVolume', 0);
  }

  const contributionMicro = recipeCostPerPortionMicro === null
    ? null
    : priceExclVatMicro - recipeCostPerPortionMicro;
  const percentagesAvailable = contributionMicro !== null && priceExclVatMicro !== 0n;
  return {
    priceExclVatMicro,
    recipeCostPerPortionMicro,
    contributionMicro,
    foodCostTenthsPct: percentagesAvailable
      ? roundDiv(recipeCostPerPortionMicro * 1_000n, priceExclVatMicro)
      : null,
    contributionMarginTenthsPct: percentagesAvailable
      ? roundDiv(contributionMicro * 1_000n, priceExclVatMicro)
      : null,
    monthlyContributionCents: contributionMicro !== null && monthlyVolume !== undefined
      ? monthlyContributionCents(contributionMicro, monthlyVolume)
      : null,
  };
}

/**
 * Calculate dish batch cost and rounded cost per portion.
 * A dish with no lines or any unknown ingredient price has unknown cost (null).
 * @param {{kind:string, portions:number, lines:object[]}} recipe Dish recipe.
 * @param {{ingredients:object[], recipes:object[]}} data Document ingredient and recipe arrays.
 * @param {{asOf?:string}} [options]
 * @returns {{batchCostMicro:bigint|null, costPerPortionMicro:bigint|null}}
 */
export function recipeCost(recipe, data, { asOf } = {}) {
  if (!recipe || recipe.kind !== 'dish') {
    throw new TypeError('recipeCost expects a dish recipe.');
  }
  const portions = safeInteger(recipe.portions, 'portions', 1);
  const totalCostMicro = recipeBatchCostMicro(recipe, data, { asOf });
  if (totalCostMicro === null) {
    return { batchCostMicro: null, costPerPortionMicro: null };
  }
  return {
    batchCostMicro: totalCostMicro,
    costPerPortionMicro: roundDiv(totalCostMicro, portions),
  };
}

/**
 * Display a package price normalized to per kg, l, or pc without changing stored values.
 * @param {number} packPriceCents Package price excluding VAT in cents.
 * @param {number} packSizeMilli Package size in thousandths of its base unit.
 * @param {string} unit Base or input unit: g/kg, ml/l, or pc.
 * @returns {string}
 */
export function packUnitPriceDisplay(packPriceCents, packSizeMilli, unit) {
  const priceCents = safeInteger(packPriceCents, 'packPriceCents', 0);
  const sizeMilli = safeInteger(packSizeMilli, 'packSizeMilli', 1);
  const baseUnit = normalizeUnit(unit);
  const displayFactorMilli = baseUnit === 'pc' ? 1_000n : 1_000_000n;
  const suffix = baseUnit === 'g' ? '/kg' : baseUnit === 'ml' ? '/l' : '/pc';
  const unitPriceCents = roundDiv(priceCents * displayFactorMilli, sizeMilli);
  return `${formatEURFromCents(unitPriceCents)}${suffix}`;
}
