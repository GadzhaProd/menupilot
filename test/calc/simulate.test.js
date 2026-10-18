import assert from 'node:assert/strict';
import test from 'node:test';
import { roundDiv } from '../../src/calc/money.js';
import {
  compare,
  createBaselineSnapshot,
  isBaselineStale,
  simulate,
} from '../../src/calc/simulate.js';

const TAKEN_AT = '2025-06-01T00:00:00.000Z';

function roundDisplayedCents(microEuros) {
  return roundDiv(microEuros, 10_000n);
}

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
  assert.throws(() => createBaselineSnapshot(data, 'dish', '2025-02-30T00:00:00Z'), /takenAt.*strict ISO/i);
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
    scenarios: [{
      result: a,
      contributionDeltaCents: -65n,
      monthlyContributionDeltaCents: -19_500n,
      ingredientCostDeltaCents: 65n,
      foodCostDeltaTenthsPct: 54n,
    }],
  });
  assert.deepEqual(
    [a.ingredientCostCents, a.netPriceCents, a.contributionCents, a.foodCostPct, a.marginPct],
    [485n, 1_200n, 715n, 404n, 596n],
  );
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
  const deltas = compare(baseResult, [b, c]).scenarios;
  assert.deepEqual(deltas.map((entry) => entry.contributionDeltaCents), [4n, 42n]);
  assert.deepEqual(deltas.map((entry) => entry.monthlyContributionDeltaCents), [1_142n, 12_600n]);
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

test('snapshots a diamond graph with shared nested prep only once', () => {
  const data = {
    ingredients: [ingredient('salt', 100)],
    recipes: [
      { id: 'base', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('base-salt', 'ingredient', 'salt', 1_000_000)] },
      { id: 'left', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('left-base', 'prep', 'base', 1_000_000)] },
      { id: 'right', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('right-base', 'prep', 'base', 1_000_000)] },
      { id: 'top', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('top-left', 'prep', 'left', 500_000), line('top-right', 'prep', 'right', 500_000)] },
      dish([line('dish-top', 'prep', 'top', 1_000_000)]),
    ],
  };
  const snapshot = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.deepEqual(snapshot.recipes.map((recipe) => recipe.id).sort(), ['base', 'dish', 'left', 'right', 'top']);
  assert.equal(snapshot.ingredients.length, 1);
  assert.equal(simulate(snapshot, {}).recipeCostPerPortionMicro, 1_000_000n);
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
  const fullQuantity = simulate(baseline, {}).recipeCostPerPortionMicro;
  assert.equal(simulate(baseline, { lineQtyMilli: { 'dish-line': 50_000 } }).recipeCostPerPortionMicro, fullQuantity / 2n);
});

test('rejects invalid price and quantity overrides without changing inputs', () => {
  const data = dataWithCost();
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  for (const value of [1.5, -1]) {
    assert.throws(() => simulate(baseline, { ingredientPriceCents: { beef: value } }), /safe integer/i);
    assert.throws(() => simulate(baseline, { lineQtyMilli: { 'beef-line': value } }), /safe integer/i);
  }
  assert.throws(() => simulate(baseline, { ingredientPriceCents: { absent: 100 } }), /unknown ingredient/i);
  const noPriceData = dataWithCost();
  noPriceData.ingredients[0].prices = [];
  const noPriceBaseline = createBaselineSnapshot(noPriceData, 'dish', TAKEN_AT);
  assert.throws(() => simulate(noPriceBaseline, { ingredientPriceCents: { beef: 100 } }), /no price pack size/i);
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

test('comparison subtracts displayed cents, including negative half-cent boundaries', () => {
  const result = (costMicro, priceMicro = 10_000_000n) => ({
    contributionMicro: priceMicro - costMicro,
    recipeCostPerPortionMicro: costMicro,
    ingredientCostCents: roundDisplayedCents(costMicro),
    contributionCents: roundDisplayedCents(priceMicro - costMicro),
    foodCostPct: 1n,
    monthlyContributionCents: null,
  });
  const before = result(4_995n);
  const after = result(5_005n);
  const centBoundaryDelta = compare(before, [after]).scenarios[0];
  assert.equal(centBoundaryDelta.contributionDeltaCents, -1n);
  assert.equal(centBoundaryDelta.ingredientCostDeltaCents, 1n);

  const negativeBefore = result(10_004_995n, 10_000_000n);
  const negativeAfter = result(10_005_005n, 10_000_000n);
  assert.equal(compare(negativeBefore, [negativeAfter]).scenarios[0].contributionDeltaCents, -1n);
});

test('detects baseline changes in current prices and prep quantities but ignores key order', () => {
  const tomatoPrices = [
    { seq: 1, recordedAt: '2025-01-01T00:00:00.000Z', packPriceCents: 180, packSizeMilli: 1_000_000 },
    { seq: 2, recordedAt: '2025-03-01T00:00:00.000Z', packPriceCents: 200, packSizeMilli: 1_000_000 },
  ];
  const data = {
    ingredients: [ingredient('tomatoes', 200, 1_000_000, tomatoPrices), ingredient('salt', 50)],
    recipes: [
      { id: 'prep', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [
        line('prep-line', 'ingredient', 'tomatoes', 100_000),
        line('salt-line', 'ingredient', 'salt', 10_000),
      ] },
      dish([line('dish-line', 'prep', 'prep', 100_000)]),
    ],
  };
  const baseline = createBaselineSnapshot(data, 'dish', TAKEN_AT);
  assert.equal(isBaselineStale(baseline, data), false);
  const reordered = structuredClone(data);
  reordered.recipes = reordered.recipes.map((recipe) => Object.fromEntries(Object.entries(recipe).reverse()));
  assert.equal(isBaselineStale(baseline, reordered), false);
  const changedPrice = structuredClone(data);
  changedPrice.ingredients[0].prices.push({ seq: 3, recordedAt: '2025-06-02T00:00:00.000Z', packPriceCents: 250, packSizeMilli: 1_000_000 });
  assert.equal(isBaselineStale(baseline, changedPrice), true);
  const changedPrep = structuredClone(data);
  changedPrep.recipes[0].lines[0].netQtyMilli = 110_000;
  assert.equal(isBaselineStale(baseline, changedPrep), true);
  const renamed = structuredClone(data);
  renamed.ingredients[0].name = 'Fresh tomatoes';
  renamed.recipes[0].name = 'Updated sauce';
  renamed.recipes[1].name = 'Updated dish name';
  assert.equal(isBaselineStale(baseline, renamed), false);
  const reorderedLines = structuredClone(data);
  reorderedLines.recipes[0].lines.reverse();
  assert.equal(isBaselineStale(baseline, reorderedLines), false);
  const reorderedEntities = structuredClone(data);
  reorderedEntities.ingredients.reverse();
  reorderedEntities.recipes.reverse();
  reorderedEntities.ingredients[1].prices.reverse();
  assert.equal(isBaselineStale(baseline, reorderedEntities), false);
  const samePriceAdded = structuredClone(data);
  samePriceAdded.ingredients[0].prices.push({ seq: 3, recordedAt: '2025-06-02T00:00:00.000Z', packPriceCents: 200, packSizeMilli: 1_000_000 });
  assert.equal(isBaselineStale(baseline, samePriceAdded), false);
  const backdatedPrice = structuredClone(data);
  backdatedPrice.ingredients[0].prices.push({ seq: 3, recordedAt: '2025-05-01T00:00:00.000Z', packPriceCents: 200, packSizeMilli: 1_000_000 });
  assert.equal(isBaselineStale(baseline, backdatedPrice), true);
  const removedDish = structuredClone(data);
  removedDish.recipes = removedDish.recipes.filter((recipe) => recipe.id !== 'dish');
  assert.equal(isBaselineStale(baseline, removedDish), true);
  const removedIngredient = structuredClone(data);
  removedIngredient.ingredients = [];
  assert.equal(isBaselineStale(baseline, removedIngredient), true);
  const invalidReachablePrice = structuredClone(data);
  invalidReachablePrice.ingredients[0].prices[0].recordedAt = 'not-a-timestamp';
  assert.equal(isBaselineStale(baseline, invalidReachablePrice), true);
});

test('rejects prep cycles while building a baseline snapshot', () => {
  const cycleData = {
    ingredients: [],
    recipes: [
      { id: 'A', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('a-b', 'prep', 'B', 1_000)] },
      { id: 'B', kind: 'prep', outputMilli: 1_000_000, outputUnit: 'g', lines: [line('b-a', 'prep', 'A', 1_000)] },
      dish([line('dish-a', 'prep', 'A', 1_000)]),
    ],
  };
  assert.throws(() => createBaselineSnapshot(cycleData, 'dish', TAKEN_AT), /cycle.*A.*B.*A/i);
});

test('does not mutate deep-frozen inputs across snapshot, simulation, comparison, and staleness checks', () => {
  const data = deepFreeze(dataWithCost());
  const dataBefore = structuredClone(data);
  const baseline = deepFreeze(createBaselineSnapshot(data, 'dish', TAKEN_AT));
  const baselineBefore = structuredClone(baseline);
  const overrides = deepFreeze({ ingredientPriceCents: { beef: 485 } });
  const result = deepFreeze(simulate(baseline, overrides));
  const baseResult = deepFreeze(simulate(baseline, {}));
  const comparisonInputs = deepFreeze([result]);
  const comparison = compare(baseResult, comparisonInputs);
  assert.deepEqual(comparison, compare(baseResult, comparisonInputs));
  isBaselineStale(baseline, data);
  assert.deepEqual(data, dataBefore);
  assert.deepEqual(baseline, baselineBefore);
});
