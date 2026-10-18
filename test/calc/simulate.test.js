import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compare,
  createBaselineSnapshot,
  isBaselineStale,
  simulate,
} from '../../src/calc/simulate.js';

const TAKEN_AT = '2025-06-01T00:00:00.000Z';

function ingredient(id, packPriceCents, packSizeMilli = 1_000_000, prices = null) {
  return {
    id,
    name: id,
    unit: 'g',
    prices: prices ?? [{ seq: 1, recordedAt: '2025-01-01T00:00:00.000Z', packPriceCents, packSizeMilli }],
  };
}

function line(id, kind, refId, netQtyMilli, yieldBp = 10_000) {
  return { id, ref: { kind, id: refId }, netQtyMilli, yieldBp };
}

function dish(lines, options = {}) {
  return {
    id: 'dish', name: 'Burger', kind: 'dish', portions: 1,
    menuPriceInclVatCents: 1_308, vatRateBp: 900, ...options, lines,
  };
}

function dataWithCost(costCents = 420) {
  return {
    version: 1,
    settings: { defaultVatRateBp: 900 },
    ingredients: [ingredient('beef', costCents, 100_000)],
    recipes: [dish([line('beef-line', 'ingredient', 'beef', 100_000)], { monthlyVolume: 300 })],
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

test('snapshots only a dish and its reachable preps and ingredients with price history', () => {
  const data = {
    ingredients: [ingredient('used', 200, 1_000_000), ingredient('unused', 300)],
    recipes: [
      { id: 'prep', name: 'Sauce', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('p-line', 'ingredient', 'used', 500_000)] },
      dish([line('dish-line', 'prep', 'prep', 100_000)]),
      { id: 'other', name: 'Other', kind: 'dish', portions: 1, lines: [] },
    ],
  };
  const before = structuredClone(data);
  const snapshot = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.deepEqual(snapshot, {
    takenAt: TAKEN_AT,
    recipeId: 'dish',
    ingredients: [data.ingredients[0]],
    recipes: [data.recipes[0], data.recipes[1]],
  });
  assert.deepEqual(data, before);
  assert.throws(() => createBaselineSnapshot(data, 'prep', TAKEN_AT), /dish/i);
  assert.throws(() => createBaselineSnapshot(data, 'absent', TAKEN_AT), /unknown recipe/i);
});

test('simulates the specification example and applies ingredient overrides at the selected pack size', () => {
  const data = dataWithCost(420);
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  const before = structuredClone(baseline);
  const baseResult = simulate(baseline, {});
  const a = simulate(baseline, { ingredientPriceCents: { beef: 485 } });
  assert.equal(baseResult.recipeCostPerPortionMicro, 4_200_000n);
  assert.equal(baseResult.priceExclVatMicro, 12_000_000n);
  assert.equal(a.recipeCostPerPortionMicro, 4_850_000n);
  assert.equal(a.contributionMicro, 7_150_000n);
  assert.equal(a.monthlyContributionCents, 214_500n);
  assert.deepEqual(compare(baseResult, [a]), {
    baseline: baseResult,
    scenarios: [{ result: a, contributionDeltaCents: -65n, monthlyContributionDeltaCents: -19_500n }],
  });
  assert.deepEqual(baseline, before);
});

test('simulates menu price and quantity changes with manually checked B and C outcomes', () => {
  const baseline = createBaselineSnapshot(dataWithCost(420), 'dish', TAKEN_AT);
  const baseResult = simulate(baseline, {});
  const b = simulate(baseline, {
    ingredientPriceCents: { beef: 485 }, menuPriceInclVatCents: 1_383,
  });
  const c = simulate(baseline, { lineQtyMilli: { 'beef-line': 90_000 } });
  // B: €13.83 / 1.09 = €12.688073 net; less €4.85 cost = €7.838073,
  // displayed as €7.84, so the rounded difference from €7.80 is +€0.04.
  assert.equal(b.priceExclVatMicro, 12_688_073n);
  assert.equal(b.contributionMicro, 7_838_073n);
  assert.equal(b.monthlyContributionCents, 235_142n);
  // C: 90% of the original €4.20 cost is €3.78; contribution rises to €8.22 (+€0.42).
  assert.equal(c.recipeCostPerPortionMicro, 3_780_000n);
  assert.equal(c.contributionMicro, 8_220_000n);
  assert.deepEqual(compare(baseResult, [b, c]).scenarios.map((entry) => entry.contributionDeltaCents), [4n, 42n]);
});

test('ingredient price override retains the package size selected at baseline date', () => {
  const priceHistory = [
    { seq: 1, recordedAt: '2025-01-01T00:00:00.000Z', packPriceCents: 420, packSizeMilli: 100_000 },
    { seq: 2, recordedAt: '2025-07-01T00:00:00.000Z', packPriceCents: 900, packSizeMilli: 500_000 },
  ];
  const data = {
    ingredients: [ingredient('beef', 420, 100_000, priceHistory)],
    recipes: [dish([line('beef-line', 'ingredient', 'beef', 100_000)])],
  };
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.equal(simulate(baseline, { ingredientPriceCents: { beef: 210 } }).recipeCostPerPortionMicro, 2_100_000n);
});

test('ingredient price overrides flow through two prep levels', () => {
  const data = {
    ingredients: [ingredient('tomatoes', 200, 1_000_000)],
    recipes: [
      { id: 'base', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('base-line', 'ingredient', 'tomatoes', 1_000_000)] },
      { id: 'sauce', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('sauce-line', 'prep', 'base', 500_000)] },
      dish([line('dish-line', 'prep', 'sauce', 1_000_000)]),
    ],
  };
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.equal(simulate(baseline, {}).recipeCostPerPortionMicro, 1_000_000n);
  assert.equal(simulate(baseline, { ingredientPriceCents: { tomatoes: 400 } }).recipeCostPerPortionMicro, 2_000_000n);
});

test('rejects quantity overrides for prep lines and unknown line ids', () => {
  const data = {
    ingredients: [ingredient('tomatoes', 200)],
    recipes: [
      { id: 'prep', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('prep-line', 'ingredient', 'tomatoes', 100_000)] },
      dish([line('dish-line', 'prep', 'prep', 100_000)]),
    ],
  };
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.throws(() => simulate(baseline, { lineQtyMilli: { 'prep-line': 50_000 } }), /top-level dish line/i);
  assert.throws(() => simulate(baseline, { lineQtyMilli: { missing: 50_000 } }), /unknown line/i);
});

test('preserves zero and missing volumes, and compares different scenario volumes independently', () => {
  const baseline = createBaselineSnapshot(dataWithCost(), 'dish', TAKEN_AT);
  const base = simulate(baseline, {});
  const zero = simulate(baseline, { monthlyVolume: 0 });
  const withoutVolume = dataWithCost();
  delete withoutVolume.recipes[0].monthlyVolume;
  const noVolume = simulate(createBaselineSnapshot(withoutVolume, 'dish', TAKEN_AT), {});
  const larger = simulate(baseline, { monthlyVolume: 100 });
  assert.equal(zero.monthlyContributionCents, 0n);
  assert.equal(noVolume.monthlyContributionCents, null);
  assert.deepEqual(compare(base, [zero, noVolume, larger]).scenarios.map((entry) => entry.monthlyContributionDeltaCents), [-234_000n, null, -156_000n]);
});

test('returns negative contribution and handles unknown cost and zero menu price in comparison', () => {
  const data = dataWithCost(2_000);
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  const negative = simulate(baseline, {});
  assert.equal(negative.contributionMicro, -8_000_000n);
  const unknownData = dataWithCost(420);
  unknownData.ingredients[0].prices = [];
  const unknownBaseline = createBaselineSnapshot(unknownData, 'dish', TAKEN_AT);
  const unknown = simulate(unknownBaseline, {});
  const zeroPrice = simulate(baseline, { menuPriceInclVatCents: 0 });
  assert.equal(unknown.status, 'cost-unknown');
  assert.equal(unknown.contributionMicro, null);
  assert.equal(zeroPrice.status, 'price-zero');
  assert.equal(compare(unknown, [unknown]).scenarios[0].contributionDeltaCents, null);
  assert.equal(compare(negative, [zeroPrice]).scenarios[0].contributionDeltaCents, -1_200n);
});

test('detects baseline changes in current prices and prep quantities but ignores key order', () => {
  const data = {
    ingredients: [ingredient('tomatoes', 200)],
    recipes: [
      { id: 'prep', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('prep-line', 'ingredient', 'tomatoes', 100_000)] },
      dish([line('dish-line', 'prep', 'prep', 100_000)]),
    ],
  };
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.equal(isBaselineStale(baseline, data), false);
  const reordered = structuredClone(data);
  reordered.recipes = reordered.recipes.map((recipe) => Object.fromEntries(Object.entries(recipe).reverse()));
  assert.equal(isBaselineStale(baseline, reordered), false);
  const changedPrice = structuredClone(data);
  changedPrice.ingredients[0].prices.push({ seq: 2, recordedAt: '2025-06-02T00:00:00.000Z', packPriceCents: 250, packSizeMilli: 1_000_000 });
  assert.equal(isBaselineStale(baseline, changedPrice), true);
  const changedPrep = structuredClone(data);
  changedPrep.recipes[0].lines[0].netQtyMilli = 110_000;
  assert.equal(isBaselineStale(baseline, changedPrep), true);
});

test('does not mutate deep-frozen inputs across snapshot, simulation, comparison, and staleness checks', () => {
  const data = deepFreeze(dataWithCost());
  const dataBefore = structuredClone(data);
  const baseline = deepFreeze(createBaselineSnapshot(data, 'dish', TAKEN_AT));
  const baselineBefore = structuredClone(baseline);
  const result = simulate(baseline, { ingredientPriceCents: { beef: 485 } });
  compare(simulate(baseline, {}), [result]);
  isBaselineStale(baseline, data);
  assert.deepEqual(data, dataBefore);
  assert.deepEqual(baseline, baselineBefore);
});
