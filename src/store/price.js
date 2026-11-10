import { instantNotAfter } from './check.js';
import { selectPriceAtDate } from '../calc/costing.js';
import { StoreError } from './errors.js';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isCalendarDay = (value) => typeof value === 'string' && DAY_PATTERN.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

/**
 * Moment a price takes effect when the owner gives its "valid from" calendar day (UTC, like the
 * Dashboard's comparison dates). A past day D is recorded at D 00:00:00.000Z, so the price counts
 * for a comparison on D (which looks at the end of D) and later, but not for D-1. Today means
 * "now". A past invoice may be added after a newer one; storage remains in addition order.
 * On a day with existing prices, keep its latest instant so the later-added `seq` wins.
 */
function effectiveInstant(effectiveDate, stamp) {
  if (!isCalendarDay(effectiveDate)) {
    throw new StoreError('invalid', 'effectiveDate must be a calendar day like 2026-01-31.');
  }
  const utcDay = (instant) => new Date(instant).toISOString().slice(0, 10);
  if (effectiveDate < '2000-01-01') {
    throw new StoreError('invalid', 'The price date must be on or after 2000-01-01.');
  }
  if (effectiveDate > utcDay(stamp)) {
    throw new StoreError('invalid', `The price date ${effectiveDate} is in the future.`);
  }
  return effectiveDate >= utcDay(stamp) ? stamp : `${effectiveDate}T00:00:00.000Z`;
}

/**
 * Shared append-only price construction for manual commands and approved plans.
 * `effectiveDate` (YYYY-MM-DD, UTC) is the optional "valid from" day; without it the price is
 * recorded at `stamp` (now).
 */
export function newPrice(prices, { packPriceCents, packSizeMilli }, stamp, effectiveDate) {
  const last = prices.at(-1);
  const moment = effectiveDate === undefined ? stamp : effectiveInstant(effectiveDate, stamp);
  // Preserve clock-backwards behaviour for undated commands. An explicit invoice day
  // only competes with prices on that UTC day, never with a later invoice day.
  const day = new Date(moment).toISOString().slice(0, 10);
  const previous = selectPriceAtDate(effectiveDate === undefined ? prices : prices.filter(price =>
    new Date(price.recordedAt).toISOString().slice(0, 10) === day));
  return {
    seq: last ? last.seq + 1 : 1,
    recordedAt: previous && instantNotAfter(moment, previous.recordedAt) ? previous.recordedAt : moment,
    packPriceCents,
    packSizeMilli,
  };
}

/** Mutate a private draft only. Caller validates the whole document before persistence. */
export function appendPrice(draft, ingredientId, price, stamp, effectiveDate) {
  const target = draft.ingredients.find(entry => entry.id === ingredientId);
  if (!target) throw new StoreError('not-found', `Unknown ingredient '${ingredientId}'.`);
  const record = newPrice(target.prices, price, stamp, effectiveDate);
  target.prices.push(record);
  return record;
}
