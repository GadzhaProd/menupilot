import assert from 'node:assert/strict';
import test from 'node:test';
import {
  batchCostMicro,
  prepLineCostMicro,
  prepUnitCostDisplay,
  recipeCost,
} from '../../src/calc/costing.js';

function ingredient(id, packPriceCents, packSizeMilli, unit = 'g', prices = null) {
  return {
    id,
    name: id,
    unit,
    prices: prices ?? [{ seq: 1, recordedAt: '2025-01-01T00:00:00.000Z', packPriceCents, packSizeMilli }],
  };
}

function line(refKind, refId, netQtyMilli, yieldBp = 10_000, unit = undefined) {
  return {
    id: `${refKind}-${refId}`,
    ref: { kind: refKind, id: refId },
    netQtyMilli,
    yieldBp,
    ...(unit ? { unit } : {}),
  };
}

function prep(id, outputMilli, outputUnit, lines) {
  return { id, name: id, kind: 'prep', outputMilli, outputUnit, lines };
}

function dish(lines, portions = 1) {
  return { id: 'dish', name: 'dish', kind: 'dish', portions, lines };
}

function document(ingredients, recipes) {
  return { ingredients, recipes };
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

test('matches the approved €1.80/kg sauce and €0.27 for 150 g example', () => {
  const ingredients = [
    ingredient('tomatoes', 200, 1_000_000),
    ingredient('spices', 1_000, 1_000_000),
  ];
  const sauce = prep('sauce', 1_000_000, 'g', [
    line('ingredient', 'tomatoes', 800_000),
    line('ingredient', 'spices', 20_000),
  ]);
  const menuDish = dish([line('prep', 'sauce', 150_000)]);
  const data = document(ingredients, [sauce, menuDish]);

  assert.equal(batchCostMicro(sauce, data), 1_800_000n);
  assert.equal(prepLineCostMicro(line('prep', 'sauce', 150_000), sauce, data), 270_000n);
  assert.equal(recipeCost(menuDish, data).costPerPortionMicro, 270_000n);
});

test('calculates nested prep recipes through three levels without dividing by prep portions', () => {
  const tomatoes = ingredient('tomatoes', 200, 1_000_000);
  const base = prep('base', 1_000_000, 'g', [line('ingredient', 'tomatoes', 1_000_000)]);
  const middle = prep('middle', 1_000_000, 'g', [line('prep', 'base', 1_000_000)]);
  const top = prep('top', 1_000_000, 'g', [line('prep', 'middle', 1_000_000)]);
  const menuDish = dish([line('prep', 'top', 250_000)]);
  const data = document([tomatoes], [base, middle, top, menuDish]);

  assert.equal(batchCostMicro(base, data), 2_000_000n);
  assert.equal(batchCostMicro(middle, data), 2_000_000n);
  assert.equal(batchCostMicro(top, data), 2_000_000n);
  assert.equal(recipeCost(menuDish, data).costPerPortionMicro, 500_000n);
});

test('uses ingredient price history at the requested date through nested prep', () => {
  const tomatoes = ingredient('tomatoes', 0, 0, 'g', [
    { seq: 1, recordedAt: '2025-01-01T00:00:00.000Z', packPriceCents: 200, packSizeMilli: 1_000_000 },
    { seq: 2, recordedAt: '2025-03-01T00:00:00.000Z', packPriceCents: 400, packSizeMilli: 1_000_000 },
  ]);
  const sauce = prep('sauce', 1_000_000, 'g', [line('ingredient', 'tomatoes', 500_000)]);
  const menuDish = dish([line('prep', 'sauce', 1_000_000)]);
  const data = document([tomatoes], [sauce, menuDish]);

  assert.equal(recipeCost(menuDish, data, { asOf: '2025-02-01T00:00:00.000Z' }).costPerPortionMicro, 1_000_000n);
  assert.equal(recipeCost(menuDish, data).costPerPortionMicro, 2_000_000n);
});

test('ingredient price changes flow through a prep into a dish', () => {
  const oldPrice = ingredient('tomatoes', 200, 1_000_000);
  const newPrice = ingredient('tomatoes', 400, 1_000_000);
  const sauce = prep('sauce', 1_000_000, 'g', [line('ingredient', 'tomatoes', 500_000)]);
  const menuDish = dish([line('prep', 'sauce', 1_000_000)]);
  const oldCost = recipeCost(menuDish, document([oldPrice], [sauce, menuDish])).costPerPortionMicro;
  const newCost = recipeCost(menuDish, document([newPrice], [sauce, menuDish])).costPerPortionMicro;

  assert.equal(oldCost, 1_000_000n);
  assert.equal(newCost, 2_000_000n);
});

test('propagates unknown ingredient cost through prep layers to the dish', () => {
  const tomatoes = ingredient('tomatoes', 0, 0, 'g', []);
  const sauce = prep('sauce', 1_000_000, 'g', [line('ingredient', 'tomatoes', 500_000)]);
  const puree = prep('puree', 1_000_000, 'g', [line('prep', 'sauce', 1_000_000)]);
  const menuDish = dish([line('prep', 'puree', 100_000)]);
  const data = document([tomatoes], [sauce, puree, menuDish]);

  assert.equal(batchCostMicro(sauce, data), null);
  assert.equal(batchCostMicro(puree, data), null);
  assert.deepEqual(recipeCost(menuDish, data), { batchCostMicro: null, costPerPortionMicro: null });
});

test('rejects self-reference and prep cycles with a readable path', () => {
  const self = prep('A', 1_000_000, 'g', [line('prep', 'A', 1_000)]);
  const a = prep('A', 1_000_000, 'g', [line('prep', 'B', 1_000)]);
  const b = prep('B', 1_000_000, 'g', [line('prep', 'A', 1_000)]);
  const selfDish = dish([line('prep', 'A', 1_000)]);
  const cycleDish = dish([line('prep', 'A', 1_000)]);

  assert.throws(() => recipeCost(selfDish, document([], [self, selfDish])), /cycle.*A.*A/i);
  assert.throws(() => recipeCost(cycleDish, document([], [a, b, cycleDish])), /cycle.*A.*B.*A/i);
});

test('allows five prep levels and rejects a sixth', () => {
  function chain(levels) {
    const recipes = [];
    for (let index = 1; index <= levels; index += 1) {
      const lines = index === levels
        ? [line('ingredient', 'salt', 1_000_000)]
        : [line('prep', `prep-${index + 1}`, 1_000_000)];
      recipes.push(prep(`prep-${index}`, 1_000_000, 'g', lines));
    }
    const menuDish = dish([line('prep', 'prep-1', 1_000_000)]);
    recipes.push(menuDish);
    return { menuDish, recipes };
  }

  const salt = ingredient('salt', 100, 1_000_000);
  const allowed = chain(5);
  assert.equal(recipeCost(allowed.menuDish, document([salt], allowed.recipes)).costPerPortionMicro, 1_000_000n);

  const tooDeep = chain(6);
  assert.throws(
    () => recipeCost(tooDeep.menuDish, document([salt], tooDeep.recipes)),
    /nesting exceeds maximum depth of 5/i,
  );
});

test('uses the referenced ingredient base unit and ignores a removed prep-line unit field', () => {
  const flour = ingredient('flour', 200, 1_000_000, 'g');
  const sauce = prep('sauce', 1_000_000, 'g', [line('ingredient', 'flour', 100_000, 10_000, 'ml')]);
  assert.equal(batchCostMicro(sauce, document([flour], [sauce])), 200_000n);
});

test('applies a prep ingredient line yield below one hundred percent', () => {
  const chicken = ingredient('chicken', 100, 1_000_000);
  const cooked = prep('cooked', 200_000, 'g', [line('ingredient', 'chicken', 100_000, 5_000)]);
  assert.equal(batchCostMicro(cooked, document([chicken], [cooked])), 200_000n);
  assert.equal(prepUnitCostDisplay(batchCostMicro(cooked, document([chicken], [cooked])), 200_000, 'g'), '€1.00/kg');
});

test('scales prep use by its 2.5 kg batch yield, not by a portion count', () => {
  const ingredientAtTenEuroPerKg = ingredient('flour', 1_000, 1_000_000);
  const prepBatch = prep('bulk-flour', 2_500_000, 'g', [line('ingredient', 'flour', 2_500_000)]);
  const menuDish = dish([line('prep', 'bulk-flour', 500_000)]);
  const data = document([ingredientAtTenEuroPerKg], [prepBatch, menuDish]);

  assert.equal(batchCostMicro(prepBatch, data), 25_000_000n);
  assert.equal(prepLineCostMicro(line('prep', 'bulk-flour', 500_000), prepBatch, data), 5_000_000n);
  assert.equal(recipeCost(menuDish, data).costPerPortionMicro, 5_000_000n);
});

test('allows a diamond-shaped prep tree to use the same prep in two branches', () => {
  const salt = ingredient('salt', 100, 1_000_000);
  const base = prep('base', 1_000_000, 'g', [line('ingredient', 'salt', 1_000_000)]);
  const left = prep('left', 1_000_000, 'g', [line('prep', 'base', 1_000_000)]);
  const right = prep('right', 1_000_000, 'g', [line('prep', 'base', 1_000_000)]);
  const top = prep('top', 1_000_000, 'g', [
    line('prep', 'left', 1_000_000),
    line('prep', 'right', 1_000_000),
  ]);
  const menuDish = dish([line('prep', 'top', 1_000_000)]);

  assert.equal(recipeCost(menuDish, document([salt], [base, left, right, top, menuDish])).costPerPortionMicro, 2_000_000n);
});

test('an empty prep referenced by a dish propagates unknown cost', () => {
  const emptyPrep = prep('empty', 1_000_000, 'g', []);
  const menuDish = dish([line('prep', 'empty', 10_000)]);
  assert.deepEqual(
    recipeCost(menuDish, document([], [emptyPrep, menuDish])),
    { batchCostMicro: null, costPerPortionMicro: null },
  );
});

test('rejects missing references and invalid prep output sizes', () => {
  const missing = prep('missing', 1_000_000, 'g', [line('ingredient', 'absent', 1_000)]);
  const invalidOutput = prep('zero', 0, 'g', [line('ingredient', 'salt', 1_000)]);
  const badUnit = prep('bad-unit', 1_000, 'cup', [line('ingredient', 'salt', 1_000)]);
  const salt = ingredient('salt', 100, 1_000_000);

  assert.throws(() => batchCostMicro(missing, document([salt], [missing])), /unknown ingredient reference/i);
  assert.throws(() => batchCostMicro(invalidOutput, document([salt], [invalidOutput])), /outputMilli/i);
  assert.throws(() => batchCostMicro(badUnit, document([salt], [badUnit])), /unsupported unit/i);
});

test('displays prep cost per kg, l, or pc with one cent rounding', () => {
  assert.equal(prepUnitCostDisplay(1_800_000n, 1_000_000, 'g'), '€1.80/kg');
  assert.equal(prepUnitCostDisplay(1_800_000n, 1_000_000, 'ml'), '€1.80/l');
  assert.equal(prepUnitCostDisplay(1_500_000n, 2_000, 'pc'), '€0.75/pc');
});

test('rounds an ingredient line at the half-micro-euro boundary', () => {
  const tiny = ingredient('tiny', 1, 20_000);
  assert.equal(batchCostMicro(prep('sample', 1_000, 'g', [line('ingredient', 'tiny', 1)]), document([tiny], [])), 1n);
});

test('does not mutate deep-frozen recipe, prep, ingredient, or document inputs', () => {
  const tomatoes = ingredient('tomatoes', 200, 1_000_000);
  const sauce = prep('sauce', 1_000_000, 'g', [line('ingredient', 'tomatoes', 500_000)]);
  const menuDish = dish([line('prep', 'sauce', 100_000)]);
  const data = deepFreeze(document([tomatoes], [sauce, menuDish]));
  const before = JSON.stringify(data);

  assert.equal(recipeCost(menuDish, data).costPerPortionMicro, 100_000n);
  assert.equal(JSON.stringify(data), before);
});
