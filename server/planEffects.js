import { packUnitPriceCents } from '../src/calc/costing.js';
import { proposalEffects } from '../src/calc/planEffects.js';
export const encodePlan = value => JSON.parse(JSON.stringify(value, (key, item) => {
  const exactAmount = typeof item === 'bigint' ||
    (typeof item === 'number' && /(?:Cents|Micro)$/.test(key));
  return exactAmount ? String(item) : item;
}));

export function packaging(price, unit) {
  return price ? {
      ...price,
      unitPrice: packUnitPriceCents(price.packPriceCents, price.packSizeMilli, unit)
    } : null;
}

export function planEffects(before, after, ingredientIds, timestamp) {
  return encodePlan(proposalEffects(before, after, Array.isArray(ingredientIds) ? ingredientIds : [ingredientIds], timestamp));
}
