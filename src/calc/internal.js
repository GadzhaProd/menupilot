import { normalizeUnit } from './units.js';

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
