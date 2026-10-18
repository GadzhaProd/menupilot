import { roundDiv } from './money.js';
import { normalizeUnit } from './units.js';

const MICRO_EUROS_PER_CENT = 10_000n;
const BASIS_POINTS = 10_000n;

/**
 * Validate a stored integer and return its exact BigInt form.
 * @param {number} value Safe integer value.
 * @param {string} name Field name for error messages.
 * @param {number} minimum Inclusive lower bound.
 * @returns {bigint}
 */
export function safeInteger(value, name, minimum) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name} must be a safe integer of at least ${minimum}.`);
  }
  return BigInt(value);
}

function parseTimestamp(value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be an ISO date string.`);
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new TypeError(`${name} must be a valid date.`);
  }
  return timestamp;
}

/**
 * Select the latest price not after `asOf`, ordered by recordedAt and then seq.
 * Without `asOf`, selects the latest record. Returns null when no record qualifies.
 * @param {{seq:number, recordedAt:string}[]} prices
 * @param {string} [asOf] Inclusive ISO timestamp cutoff.
 * @returns {{seq:number, recordedAt:string, packPriceCents:number, packSizeMilli:number}|null}
 */
export function selectPriceAtDate(prices, asOf) {
  if (!Array.isArray(prices)) {
    throw new TypeError('Price history must be an array.');
  }
  const cutoff = asOf === undefined ? null : parseTimestamp(asOf, 'asOf');
  let selected = null;
  let selectedTimestamp = null;

  for (const price of prices) {
    if (!price || typeof price !== 'object') {
      throw new TypeError('Each price history record must be an object.');
    }
    const timestamp = parseTimestamp(price.recordedAt, 'recordedAt');
    const sequence = safeInteger(price.seq, 'seq', 0);
    if (cutoff !== null && timestamp > cutoff) {
      continue;
    }
    if (
      selected === null ||
      timestamp > selectedTimestamp ||
      (timestamp === selectedTimestamp && sequence > BigInt(selected.seq))
    ) {
      selected = price;
      selectedTimestamp = timestamp;
    }
  }

  return selected;
}

/**
 * Validate a quantity in milli-units, yield in basis points, and optional line unit.
 * @param {{netQtyMilli:number, yieldBp:number, unit?:string}} line
 * @param {'g'|'ml'|'pc'} targetUnit Referenced ingredient or prep base unit.
 * @returns {void}
 */
export function validateLine(line, targetUnit) {
  if (!line || typeof line !== 'object') {
    throw new TypeError('Recipe line must be an object.');
  }
  safeInteger(line.netQtyMilli, 'netQtyMilli', 1);
  safeInteger(line.yieldBp, 'yieldBp', 1);
  if (line.yieldBp > 10_000) {
    throw new TypeError('yieldBp must not exceed 10000.');
  }
  if (line.unit !== undefined && normalizeUnit(line.unit) !== targetUnit) {
    throw new TypeError(`Line unit ${line.unit} does not match referenced unit ${targetUnit}.`);
  }
}

/**
 * Calculate one ingredient recipe line in integer micro-euros.
 * @param {{unit:string, prices:object[]}} ingredient
 * @param {{netQtyMilli:number, yieldBp:number, unit?:string}} line
 * @param {{asOf?:string}} [options]
 * @returns {bigint|null} Cost in micro-euros, or null when price is unknown.
 */
export function ingredientLineCostMicro(ingredient, line, { asOf } = {}) {
  if (!ingredient || typeof ingredient !== 'object') {
    throw new TypeError('Ingredient must be an object.');
  }
  const ingredientUnit = normalizeUnit(ingredient.unit);
  validateLine(line, ingredientUnit);
  const priceHistory = ingredient.prices ?? [];
  const price = selectPriceAtDate(priceHistory, asOf);
  if (price === null) {
    return null;
  }

  const packPriceCents = safeInteger(price.packPriceCents, 'packPriceCents', 0);
  const packSizeMilli = safeInteger(price.packSizeMilli, 'packSizeMilli', 1);
  const quantityMilli = BigInt(line.netQtyMilli);
  const yieldBp = BigInt(line.yieldBp);
  const numerator = packPriceCents * MICRO_EUROS_PER_CENT * quantityMilli * BASIS_POINTS;
  const denominator = packSizeMilli * yieldBp;
  return roundDiv(numerator, denominator);
}
