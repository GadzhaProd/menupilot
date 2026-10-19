import { formatEURFromCents, roundDiv } from './money.js';
import { normalizeUnit } from './units.js';
import { recipeBatchCostMicro } from './prep.js';
import {
  ingredientLineCostMicroInternal,
  safeInteger,
  selectPriceAtDateInternal,
} from './internal.js';
import { BASIS_POINTS, MICRO_EUROS_PER_CENT } from './constants.js';

export { batchCostMicro, prepLineCostMicro, prepUnitCostDisplay, prepUnitCostCents } from './prep.js';

/**
 * Select the latest valid price at or before a strict ISO timestamp cutoff.
 * Without `asOf`, selects the latest record. Ties use the larger sequence.
 * @param {{seq:number, recordedAt:string, packPriceCents:number, packSizeMilli:number}[]} prices
 * @param {string} [asOf] ISO timestamp including a time zone, such as 2025-01-01T00:00:00Z.
 * @returns {{seq:number, recordedAt:string, packPriceCents:number, packSizeMilli:number}|null}
 */
export function selectPriceAtDate(prices, asOf) {
  return selectPriceAtDateInternal(prices, asOf);
}

/**
 * Calculate one ingredient line in integer micro-euros.
 * @param {{unit:string, prices:object[]}} ingredient
 * @param {{netQtyMilli:number, yieldBp:number}} line Quantity uses the ingredient's base unit.
 * @param {{asOf?:string}} [options]
 * @returns {bigint|null} Cost in micro-euros, or null when price is unknown.
 */
export function ingredientLineCostMicro(ingredient, line, options = {}) {
  return ingredientLineCostMicroInternal(ingredient, line, options);
}

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
 * Percentages are rounded to tenths. Null percentages are explained by `status`:
 * cost-unknown means a missing cost; price-zero means division is not applicable.
 * @param {{recipeCostPerPortionMicro:bigint|null, menuPriceInclVatCents:number, vatRateBp:number, monthlyVolume?:number|null}} input
 * @returns {{status:'ready'|'cost-unknown'|'price-zero', priceExclVatMicro:bigint, recipeCostPerPortionMicro:bigint|null, contributionMicro:bigint|null, foodCostTenthsPct:bigint|null, contributionMarginTenthsPct:bigint|null, monthlyContributionCents:bigint|null}}
 */
export function metrics({ recipeCostPerPortionMicro, menuPriceInclVatCents, vatRateBp, monthlyVolume } = {}) {
  if (recipeCostPerPortionMicro !== null && typeof recipeCostPerPortionMicro !== 'bigint') {
    throw new TypeError('Recipe cost must be a BigInt in micro-euros or null.');
  }
  const priceExclVatMicro = netPriceMicro(menuPriceInclVatCents, vatRateBp);
  const volumeWasProvided = monthlyVolume !== null && monthlyVolume !== undefined;
  if (volumeWasProvided) {
    safeInteger(monthlyVolume, 'monthlyVolume', 0);
  }

  const contributionMicro = recipeCostPerPortionMicro === null
    ? null
    : priceExclVatMicro - recipeCostPerPortionMicro;
  let status;
  if (contributionMicro === null) {
    status = 'cost-unknown';
  } else if (priceExclVatMicro === 0n) {
    status = 'price-zero';
  } else {
    status = 'ready';
  }
  const percentagesAvailable = status === 'ready';
  return {
    status,
    priceExclVatMicro,
    recipeCostPerPortionMicro,
    contributionMicro,
    foodCostTenthsPct: percentagesAvailable
      ? roundDiv(recipeCostPerPortionMicro * 1_000n, priceExclVatMicro)
      : null,
    contributionMarginTenthsPct: percentagesAvailable
      ? roundDiv(contributionMicro * 1_000n, priceExclVatMicro)
      : null,
    monthlyContributionCents: contributionMicro !== null && volumeWasProvided
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
 * Package price per kg, l, or pc in exact display cents, without changing stored values.
 * @param {number} packPriceCents Package price excluding VAT in cents.
 * @param {number} packSizeMilli Package size in thousandths of its base unit.
 * @param {string} unit Base or input unit: g/kg, ml/l, or pc.
 * @returns {{cents: bigint, per: 'kg'|'l'|'pc'}}
 */
export function packUnitPriceCents(packPriceCents, packSizeMilli, unit) {
  const priceCents = safeInteger(packPriceCents, 'packPriceCents', 0);
  const sizeMilli = safeInteger(packSizeMilli, 'packSizeMilli', 1);
  const baseUnit = normalizeUnit(unit);
  const displayFactorMilli = baseUnit === 'pc' ? 1_000n : 1_000_000n;
  const unitPriceCents = roundDiv(priceCents * displayFactorMilli, sizeMilli);
  return { cents: unitPriceCents, per: baseUnit === 'g' ? 'kg' : baseUnit === 'ml' ? 'l' : 'pc' };
}

/** Legacy EN display; numeric calculation and rounding stay in packUnitPriceCents.
 * @param {number} packPriceCents @param {number} packSizeMilli @param {string} unit
 * @returns {string}
 */
export function packUnitPriceDisplay(packPriceCents, packSizeMilli, unit) {
  const { cents, per } = packUnitPriceCents(packPriceCents, packSizeMilli, unit);
  return `${formatEURFromCents(cents)}/${per}`;
}
