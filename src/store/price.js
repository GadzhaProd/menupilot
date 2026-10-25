import { instantNotAfter } from './check.js';
import { StoreError } from './errors.js';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isCalendarDay = (value) => typeof value === 'string' && DAY_PATTERN.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

/**
 * Moment a price takes effect when the owner gives its "valid from" calendar day (UTC, like the
 * Dashboard's comparison dates). A past day D is recorded at D 00:00:00.000Z, so the price counts
 * for a comparison on D (which looks at the end of D) and later, but not for D-1. Today means
 * "now". History stays non-decreasing: a day not before the previous price's day is required, and
 * on that same day the previous record's instant is kept (the newer `seq` still wins).
 */
function effectiveInstant(prices, effectiveDate, stamp) {
  if (!isCalendarDay(effectiveDate)) {
    throw new StoreError('invalid', 'effectiveDate must be a calendar day like 2026-01-31.');
  }
  const utcDay = (instant) => new Date(instant).toISOString().slice(0, 10);
  const last = prices.at(-1);
  if (last && effectiveDate < utcDay(last.recordedAt)) {
    throw new StoreError('invalid', `The price date ${effectiveDate} is earlier than the previous price (${utcDay(last.recordedAt)}).`);
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
  const moment = effectiveDate === undefined ? stamp : effectiveInstant(prices, effectiveDate, stamp);
  return {
    seq: last ? last.seq + 1 : 1,
    recordedAt: last && instantNotAfter(moment, last.recordedAt) ? last.recordedAt : moment,
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
