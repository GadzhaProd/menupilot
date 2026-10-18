import { readFileSync } from 'node:fs';

/** localStorage-like object backed by a Map; `failOnSet` makes writes throw. */
export function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    failOnSet: null,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (this.failOnSet) {
        throw this.failOnSet;
      }
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

export function quotaError() {
  const error = new Error('The quota has been exceeded.');
  error.name = 'QuotaExceededError';
  return error;
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

export const clone = (value) => structuredClone(value);

export function readDemo() {
  return JSON.parse(readFileSync(new URL('../../data/demo.json', import.meta.url), 'utf8'));
}

/** Fixed demo reference moment; see src/store/demo.js. */
export const DEMO_NOW = '2026-10-18T12:00:00.000Z';

export function daysBefore(isoInstant, days) {
  return new Date(Date.parse(isoInstant) - days * 86_400_000).toISOString();
}

export function line(id, kind, refId, netQtyMilli = 1000, yieldBp = 10_000) {
  return { id, ref: { kind, id: refId }, netQtyMilli, yieldBp };
}

export function prep(id, lines, outputMilli = 1_000_000) {
  return { id, name: id, kind: 'prep', outputMilli, outputUnit: 'g', lines };
}

export function dish(id, lines) {
  return {
    id, name: id, kind: 'dish', menuPriceInclVatCents: 1000, vatRateBp: 900, portions: 1, lines,
  };
}

export function ingredient(id, unit = 'g') {
  return {
    id,
    name: id,
    unit,
    prices: [{
      seq: 1, recordedAt: '2026-01-01T00:00:00.000Z', packPriceCents: 500, packSizeMilli: 1_000_000,
    }],
  };
}

/** Smallest interesting valid document: ingredient i1, prep p1 (uses i1), dish d1 (uses p1). */
export function smallDocument() {
  return {
    version: 1,
    settings: { defaultVatRateBp: 900 },
    ingredients: [ingredient('i1'), ingredient('i2')],
    recipes: [
      prep('p1', [line('l1', 'ingredient', 'i1')]),
      dish('d1', [line('l1', 'prep', 'p1')]),
    ],
    scenarios: [],
  };
}

/** Test-only baseline builder following the shared snapshot contract. */
export function makeBaseline(doc, recipeId, takenAt) {
  const recipeById = new Map(doc.recipes.map((recipe) => [recipe.id, recipe]));
  const recipeIds = new Set();
  const ingredientIds = new Set();
  const visit = (id) => {
    if (recipeIds.has(id)) return;
    recipeIds.add(id);
    for (const { ref } of recipeById.get(id).lines) {
      if (ref.kind === 'prep') visit(ref.id);
      else ingredientIds.add(ref.id);
    }
  };
  visit(recipeId);
  return clone({
    takenAt,
    recipeId,
    ingredients: doc.ingredients.filter((entry) => ingredientIds.has(entry.id)),
    recipes: doc.recipes.filter((entry) => recipeIds.has(entry.id)),
  });
}

export function makeScenario(doc, recipeId, overrides = {}, id = 'sc1') {
  return {
    id,
    recipeId,
    name: 'Cheaper beef',
    createdAt: '2026-10-18T12:00:00.000Z',
    baseline: makeBaseline(doc, recipeId, '2026-10-18T12:00:00.000Z'),
    overrides,
  };
}
