import { instantNotAfter } from './check.js';
import { StoreError } from './errors.js';

/** Shared append-only price construction for manual commands and approved plans. */
export function newPrice(prices, { packPriceCents, packSizeMilli }, stamp) {
  const last = prices.at(-1);
  return {
    seq: last ? last.seq + 1 : 1,
    recordedAt: last && instantNotAfter(stamp, last.recordedAt) ? last.recordedAt : stamp,
    packPriceCents,
    packSizeMilli,
  };
}

/** Mutate a private draft only. Caller validates the whole document before persistence. */
export function appendPrice(draft, ingredientId, price, stamp) {
  const target = draft.ingredients.find(entry => entry.id === ingredientId);
  if (!target) throw new StoreError('not-found', `Unknown ingredient '${ingredientId}'.`);
  const record = newPrice(target.prices, price, stamp);
  target.prices.push(record);
  return record;
}
