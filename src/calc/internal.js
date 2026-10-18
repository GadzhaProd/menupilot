import { BASIS_POINTS, MICRO_EUROS_PER_CENT } from './constants.js';
import { roundDiv } from './money.js';
import { normalizeUnit } from './units.js';

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const ISO_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;
const NANOSECONDS_PER_SECOND = 1_000_000_000n;

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

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

function daysSinceUnixEpoch(year, month, day) {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const shiftedMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365
    + Math.floor(yearOfEra / 4)
    - Math.floor(yearOfEra / 100)
    + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

function parseStrictIsoInstant(value, name) {
  const errorMessage = `${name} must be a strict ISO timestamp with time zone.`;
  if (typeof value !== 'string') {
    throw new TypeError(errorMessage);
  }

  const match = ISO_INSTANT_PATTERN.exec(value);
  if (!match) {
    throw new TypeError(errorMessage);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const second = Number.parseInt(match[6], 10);
  const offsetHour = match[10] ? Number.parseInt(match[10], 10) : 0;
  const offsetMinute = match[11] ? Number.parseInt(match[11], 10) : 0;
  if (
    month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month) ||
    hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59
  ) {
    throw new TypeError(errorMessage);
  }

  const offsetDirection = match[9] === '+' ? 1n : -1n;
  const offsetSeconds = match[9]
    ? offsetDirection * (BigInt(offsetHour) * 3_600n + BigInt(offsetMinute) * 60n)
    : 0n;
  const localSeconds = BigInt(daysSinceUnixEpoch(year, month, day)) * 86_400n
    + BigInt(hour) * 3_600n
    + BigInt(minute) * 60n
    + BigInt(second);
  const fractionalNanoseconds = BigInt((match[7] ?? '').padEnd(9, '0') || '0');
  return (localSeconds - offsetSeconds) * NANOSECONDS_PER_SECOND + fractionalNanoseconds;
}

/** Validate a strict ISO timestamp with an explicit timezone.
 * @param {string} value Timestamp to validate.
 * @param {string} [name='timestamp'] Field name used in the error.
 * @returns {void}
 */
export function assertStrictIsoTimestamp(value, name = 'timestamp') {
  parseStrictIsoInstant(value, name);
}

/**
 * Select a price using strict timestamp parsing; used by the public costing API.
 * @param {{seq:number, recordedAt:string}[]} prices
 * @param {string} [asOf]
 * @returns {{seq:number, recordedAt:string, packPriceCents:number, packSizeMilli:number}|null}
 */
export function selectPriceAtDateInternal(prices, asOf) {
  if (!Array.isArray(prices)) {
    throw new TypeError('Price history must be an array.');
  }
  const cutoff = asOf === undefined ? null : parseStrictIsoInstant(asOf, 'asOf');
  let selected = null;
  let selectedTimestampNanoseconds = null;
  let selectedSequence = null;

  for (const price of prices) {
    if (!price || typeof price !== 'object') {
      throw new TypeError('Each price history record must be an object.');
    }
    const timestampNanoseconds = parseStrictIsoInstant(price.recordedAt, 'recordedAt');
    const sequence = safeInteger(price.seq, 'seq', 0);
    if (cutoff !== null && timestampNanoseconds > cutoff) {
      continue;
    }
    if (
      selected === null || timestampNanoseconds > selectedTimestampNanoseconds ||
      (timestampNanoseconds === selectedTimestampNanoseconds && sequence > selectedSequence)
    ) {
      selected = price;
      selectedTimestampNanoseconds = timestampNanoseconds;
      selectedSequence = sequence;
    }
  }

  return selected;
}

/**
 * Validate the stored milli-quantity and basis-point yield on a recipe line.
 * The line quantity is already in the referenced ingredient or prep base unit.
 * @param {{netQtyMilli:number, yieldBp:number}} line
 * @returns {void}
 */
export function validateLineAmounts(line) {
  if (!line || typeof line !== 'object') {
    throw new TypeError('Recipe line must be an object.');
  }
  safeInteger(line.netQtyMilli, 'netQtyMilli', 1);
  safeInteger(line.yieldBp, 'yieldBp', 1);
  if (BigInt(line.yieldBp) > BASIS_POINTS) {
    throw new TypeError(`yieldBp must not exceed ${BASIS_POINTS}.`);
  }
}

/**
 * Calculate an ingredient line for internal use by prep recursion.
 * @param {{unit:string, prices:object[]}} ingredient
 * @param {{netQtyMilli:number, yieldBp:number}} line
 * @param {{asOf?:string}} [options]
 * @returns {bigint|null} Cost in micro-euros, or null when price is unknown.
 */
export function ingredientLineCostMicroInternal(ingredient, line, { asOf } = {}) {
  if (!ingredient || typeof ingredient !== 'object') {
    throw new TypeError('Ingredient must be an object.');
  }
  normalizeUnit(ingredient.unit);
  validateLineAmounts(line);
  const priceHistory = ingredient.prices ?? [];
  const price = selectPriceAtDateInternal(priceHistory, asOf);
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
