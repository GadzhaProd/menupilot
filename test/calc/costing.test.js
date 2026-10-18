import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ingredientLineCostMicro,
  metrics,
  monthlyContributionCents,
  netPriceMicro,
  packUnitPriceDisplay,
  recipeCost,
  selectPriceAtDate,
} from '../../src/calc/costing.js';

const RECORDED_AT = '2025-04-01T09:00:00.000Z';

function makeIngredient(id, packPriceCents, packSizeMilli, unit = 'g', prices = null) {
  return {
    id,
    name: id,
    unit,
    prices: prices ?? [{ seq: 1, recordedAt: RECORDED_AT, packPriceCents, packSizeMilli }],
  };
}

function makeLine(id, netQtyMilli, yieldBp = 10_000, unit = undefined) {
  return {
    id,
    ref: { kind: 'ingredient', id },
    netQtyMilli,
    yieldBp,
    ...(unit ? { unit } : {}),
  };
}

function makeDish(lines, portions = 1) {
  return { id: 'dish', kind: 'dish', portions, lines };
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

test('converts menu price excl. VAT and calculates the approved contribution example', () => {
  const baseline = metrics({
    recipeCostPerPortionMicro: 4_200_000n,
    menuPriceInclVatCents: 1_308,
    vatRateBp: 900,
    monthlyVolume: 300,
  });
  const current = metrics({
    recipeCostPerPortionMicro: 4_850_000n,
    menuPriceInclVatCents: 1_308,
    vatRateBp: 900,
    monthlyVolume: 300,
  });

  assert.equal(baseline.priceExclVatMicro, 12_000_000n);
  assert.equal(baseline.contributionMicro, 7_800_000n);
  assert.equal(baseline.foodCostTenthsPct, 350n);
  assert.equal(baseline.contributionMarginTenthsPct, 650n);
  assert.equal(baseline.monthlyContributionCents, 234_000n);
  assert.equal(current.priceExclVatMicro, 12_000_000n);
  assert.equal(current.contributionMicro, 7_150_000n);
  assert.equal(current.monthlyContributionCents, 214_500n);
  assert.equal(current.monthlyContributionCents - baseline.monthlyContributionCents, -19_500n);
  assert.equal(current.contributionMicro - baseline.contributionMicro, -650_000n);
});

test('calculates a menu price without 21% VAT in micro-euros', () => {
  assert.equal(netPriceMicro(12_100, 2_100), 100_000_000n);
});

test('rounds monthly contribution to cents once and accepts a zero volume', () => {
  assert.equal(monthlyContributionCents(1_234_567n, 3), 370n);
  assert.equal(monthlyContributionCents(-1_234_567n, 3), -370n);
  assert.equal(monthlyContributionCents(1_234_567n, 0), 0n);
});

test('returns n/a percentage metrics for a zero menu price and unknown values for unknown cost', () => {
  const zeroPrice = metrics({
    recipeCostPerPortionMicro: 1_000_000n,
    menuPriceInclVatCents: 0,
    vatRateBp: 900,
    monthlyVolume: 10,
  });
  assert.equal(zeroPrice.priceExclVatMicro, 0n);
  assert.equal(zeroPrice.contributionMicro, -1_000_000n);
  assert.equal(zeroPrice.foodCostTenthsPct, null);
  assert.equal(zeroPrice.contributionMarginTenthsPct, null);

  const unknown = metrics({
    recipeCostPerPortionMicro: null,
    menuPriceInclVatCents: 1_000,
    vatRateBp: 900,
    monthlyVolume: 10,
  });
  assert.equal(unknown.priceExclVatMicro, 9_174_312n);
  assert.equal(unknown.contributionMicro, null);
  assert.equal(unknown.foodCostTenthsPct, null);
  assert.equal(unknown.contributionMarginTenthsPct, null);
  assert.equal(unknown.monthlyContributionCents, null);
});

test('manually recalculates three dishes from ingredient pack prices', () => {
  const ingredients = [
    makeIngredient('chicken', 800, 1_000_000),
    makeIngredient('rice', 200, 1_000_000),
    makeIngredient('beef', 1_200, 1_000_000),
    makeIngredient('bun', 50, 1_000, 'pc'),
    makeIngredient('tomato', 300, 1_000_000),
    makeIngredient('oil', 600, 1_000_000, 'ml'),
  ];
  const data = { ingredients, recipes: [] };

  // Chicken rice: 150 g chicken at 80% yield costs €1.50; 80 g rice costs €0.16; total €1.66.
  const chickenRice = recipeCost(makeDish([makeLine('chicken', 150_000, 8_000), makeLine('rice', 80_000)]), data);
  // Burger: 180 g beef at €12/kg costs €2.16; one bun at €0.50 makes €2.66.
  const burger = recipeCost(makeDish([makeLine('beef', 180_000), makeLine('bun', 1_000)]), data);
  // Salad: 100 g tomato at €3/kg costs €0.30; 20 ml oil at €6/l costs €0.12; total €0.42.
  const salad = recipeCost(makeDish([makeLine('tomato', 100_000), makeLine('oil', 20_000)]), data);

  assert.equal(chickenRice.batchCostMicro, 1_660_000n);
  assert.equal(burger.batchCostMicro, 2_660_000n);
  assert.equal(salad.batchCostMicro, 420_000n);
});

test('applies yield to the individual ingredient line only', () => {
  const chicken = makeIngredient('chicken', 200, 1_000_000);
  assert.equal(ingredientLineCostMicro(chicken, makeLine('chicken', 100_000, 8_000)), 250_000n);
  assert.equal(ingredientLineCostMicro(chicken, makeLine('chicken', 100_000, 10_000)), 200_000n);
});

test('divides a recipe batch cost by its safe integer portion count', () => {
  const flour = makeIngredient('flour', 420, 100_000);
  const result = recipeCost(makeDish([makeLine('flour', 100_000)], 2), {
    ingredients: [flour],
    recipes: [],
  });
  assert.equal(result.batchCostMicro, 4_200_000n);
  assert.equal(result.costPerPortionMicro, 2_100_000n);
});

test('selects the price at or before a date, breaking timestamp ties by sequence', () => {
  const prices = [
    { seq: 1, recordedAt: '2025-01-01T12:00:00.000Z', packPriceCents: 100, packSizeMilli: 1_000 },
    { seq: 3, recordedAt: '2025-01-01T12:00:00.000Z', packPriceCents: 300, packSizeMilli: 1_000 },
    { seq: 4, recordedAt: '2025-02-01T12:00:00.000Z', packPriceCents: 400, packSizeMilli: 1_000 },
  ];
  assert.equal(selectPriceAtDate(prices, '2025-01-15T00:00:00.000Z').seq, 3);
  assert.equal(selectPriceAtDate(prices, '2024-12-31T23:59:59.000Z'), null);
  assert.equal(selectPriceAtDate(prices).seq, 4);
});

test('uses the selected historical price when costing a dish as of a date', () => {
  const ingredient = makeIngredient('coffee', 0, 1_000, 'g', [
    { seq: 1, recordedAt: '2025-01-01T00:00:00.000Z', packPriceCents: 100, packSizeMilli: 1_000 },
    { seq: 2, recordedAt: '2025-03-01T00:00:00.000Z', packPriceCents: 200, packSizeMilli: 1_000 },
  ]);
  const dish = makeDish([makeLine('coffee', 1_000)]);
  const data = { ingredients: [ingredient], recipes: [] };
  assert.equal(recipeCost(dish, data, { asOf: '2025-02-01T00:00:00.000Z' }).batchCostMicro, 1_000_000n);
  assert.equal(recipeCost(dish, data).batchCostMicro, 2_000_000n);
  assert.throws(() => selectPriceAtDate(ingredient.prices, 'not a date'), /asOf/i);
});

test('prices a package per kg, l, or pc without changing pack values', () => {
  assert.equal(packUnitPriceDisplay(1_120, 1_000_000, 'g'), '€11.20/kg');
  assert.equal(packUnitPriceDisplay(280, 250_000, 'g'), '€11.20/kg');
  assert.equal(packUnitPriceDisplay(280, 250_000, 'ml'), '€11.20/l');
  assert.equal(packUnitPriceDisplay(280, 4_000, 'pc'), '€0.70/pc');
});

test('keeps large ingredient arithmetic exact with BigInt', () => {
  const ingredient = makeIngredient('large', Number.MAX_SAFE_INTEGER, 1);
  const cost = ingredientLineCostMicro(ingredient, makeLine('large', 1));
  assert.equal(cost, BigInt(Number.MAX_SAFE_INTEGER) * 10_000n);
});

test('rejects invalid quantities, yields, portions, and unsafe stored integers', () => {
  const ingredient = makeIngredient('sugar', 200, 1_000_000);
  assert.throws(() => ingredientLineCostMicro(ingredient, makeLine('sugar', 0)), /netQtyMilli/i);
  assert.throws(() => ingredientLineCostMicro(ingredient, makeLine('sugar', 1_000, 0)), /yield/i);
  assert.throws(() => ingredientLineCostMicro(ingredient, makeLine('sugar', 1_000, 10_001)), /yield/i);
  assert.throws(() => recipeCost(makeDish([makeLine('sugar', 1_000)], 0), {
    ingredients: [ingredient],
    recipes: [],
  }), /portions/i);
  const unsafeIngredient = makeIngredient('unsafe', 200, Number.MAX_SAFE_INTEGER + 1);
  assert.throws(() => ingredientLineCostMicro(unsafeIngredient, makeLine('unsafe', 1_000)), /safe integer/i);
});

test('rejects an explicit line unit that differs from its referenced ingredient', () => {
  const flour = makeIngredient('flour', 200, 1_000_000, 'g');
  assert.throws(
    () => ingredientLineCostMicro(flour, makeLine('flour', 1_000, 10_000, 'ml')),
    /does not match referenced unit/i,
  );
});

test('keeps empty recipes and missing prices unknown instead of treating them as zero', () => {
  const noIngredients = recipeCost(makeDish([]), { ingredients: [], recipes: [] });
  const noPrice = recipeCost(makeDish([makeLine('salt', 1_000)]), {
    ingredients: [makeIngredient('salt', 0, 0, 'g', [])],
    recipes: [],
  });
  assert.deepEqual(noIngredients, { batchCostMicro: null, costPerPortionMicro: null });
  assert.deepEqual(noPrice, { batchCostMicro: null, costPerPortionMicro: null });
});

test('does not mutate frozen recipe or ingredient data', () => {
  const document = deepFreeze({
    ingredients: [makeIngredient('oil', 600, 1_000_000, 'ml')],
    recipes: [],
  });
  const dish = deepFreeze(makeDish([makeLine('oil', 20_000)]));
  const before = JSON.stringify({ document, dish });
  assert.equal(recipeCost(dish, document).batchCostMicro, 120_000n);
  assert.equal(JSON.stringify({ document, dish }), before);
});
