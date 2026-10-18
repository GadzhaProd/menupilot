import assert from 'node:assert/strict';
import test from 'node:test';
import { recipeCost } from '../../src/calc/costing.js';
import {
  validateDocument, validateIngredient, validateRecipe, validateScenario,
} from '../../src/store/schema.js';
import {
  clone, dish, ingredient, line, makeScenario, prep, readDemo, smallDocument,
} from './fixtures.js';

function errorsOf(mutate, base = smallDocument()) {
  const doc = clone(base);
  mutate(doc);
  return validateDocument(doc).errors;
}

function assertRejects(mutate, pattern, base) {
  const errors = errorsOf(mutate, base);
  assert.ok(errors.length > 0, `expected errors matching ${pattern}`);
  assert.ok(errors.some((message) => pattern.test(message)), `no error matches ${pattern}: ${errors.join(' | ')}`);
}

test('the demo document and a small document are valid', () => {
  assert.deepEqual(validateDocument(readDemo()), { valid: true, errors: [] });
  assert.deepEqual(validateDocument(smallDocument()), { valid: true, errors: [] });
});

test('rejects wrong version, non-objects and missing collections', () => {
  assertRejects((doc) => { doc.version = 2; }, /version.*1/);
  assert.match(validateDocument(null).errors[0], /document must be an object/i);
  assertRejects((doc) => { delete doc.ingredients; }, /ingredients.*array/);
  assertRejects((doc) => { doc.extra = 1; }, /extra.*unknown/i);
});

test('errors name the path of the broken field', () => {
  assertRejects((doc) => { doc.recipes[1].portions = 0; }, /^recipes\[1\]\.portions: /);
  assertRejects((doc) => { doc.ingredients[0].prices[0].packSizeMilli = 0; }, /^ingredients\[0\]\.prices\[0\]\.packSizeMilli: /);
});

test('money and quantities must be safe integers', () => {
  assertRejects((doc) => { doc.ingredients[0].prices[0].packPriceCents = 1.5; }, /packPriceCents.*integer/);
  assertRejects((doc) => { doc.ingredients[0].prices[0].packPriceCents = -1; }, /packPriceCents/);
  assertRejects((doc) => { doc.ingredients[0].prices[0].packPriceCents = '500'; }, /packPriceCents/);
  assertRejects((doc) => { doc.ingredients[0].prices[0].packSizeMilli = 2 ** 53; }, /packSizeMilli/);
  assertRejects((doc) => { doc.recipes[1].menuPriceInclVatCents = 12.5; }, /menuPriceInclVatCents/);
  assertRejects((doc) => { doc.recipes[1].lines[0].netQtyMilli = 0; }, /netQtyMilli/);
});

test('ranges: VAT 0..10000, yield 1..10000, portions >= 1, volume integer >= 0', () => {
  assertRejects((doc) => { doc.recipes[1].vatRateBp = 10_001; }, /vatRateBp/);
  assertRejects((doc) => { doc.recipes[1].vatRateBp = -1; }, /vatRateBp/);
  assertRejects((doc) => { doc.recipes[0].lines[0].yieldBp = 0; }, /yieldBp/);
  assertRejects((doc) => { doc.recipes[0].lines[0].yieldBp = 10_001; }, /yieldBp/);
  assertRejects((doc) => { doc.recipes[1].portions = 0; }, /portions/);
  assertRejects((doc) => { doc.recipes[1].monthlyVolume = -1; }, /monthlyVolume/);
  assertRejects((doc) => { doc.recipes[1].monthlyVolume = 1.5; }, /monthlyVolume/);
  assertRejects((doc) => { doc.settings.defaultVatRateBp = 20_000; }, /defaultVatRateBp/);
  assert.deepEqual(errorsOf((doc) => { doc.recipes[1].monthlyVolume = 0; }), []);
  assert.deepEqual(errorsOf((doc) => { doc.recipes[1].vatRateBp = 0; }), []);
  assert.deepEqual(errorsOf((doc) => { doc.recipes[0].lines[0].yieldBp = 10_000; }), []);
});

test('names and ids must be non-empty text; ids are unique', () => {
  assertRejects((doc) => { doc.ingredients[0].name = '  '; }, /name/);
  assertRejects((doc) => { doc.ingredients[0].id = ''; }, /id/);
  assertRejects((doc) => { doc.ingredients[1].id = 'i1'; }, /duplicate id/i);
  assertRejects((doc) => { doc.recipes[1].id = 'p1'; }, /duplicate id/i);
  assertRejects((doc) => { doc.recipes[0].lines.push(line('l1', 'ingredient', 'i2')); }, /duplicate line id/i);
});

test('timestamps must be strict ISO instants with a time zone', () => {
  assertRejects((doc) => { doc.ingredients[0].prices[0].recordedAt = '2026-01-01'; }, /recordedAt.*ISO/);
  assertRejects((doc) => { doc.ingredients[0].prices[0].recordedAt = '2026-13-01T00:00:00Z'; }, /recordedAt/);
  assert.deepEqual(errorsOf((doc) => { doc.ingredients[0].prices[0].recordedAt = '2026-01-01T01:00:00+01:00'; }), []);
});

test('ingredient units are base units only', () => {
  assertRejects((doc) => { doc.ingredients[0].unit = 'kg'; }, /unit.*g, ml or pc/);
  assertRejects((doc) => { doc.ingredients[0].unit = 'oz'; }, /unit/);
  assertRejects((doc) => { doc.recipes[0].outputUnit = 'l'; }, /outputUnit/);
});

test('dish and prep fields are exclusive', () => {
  assertRejects((doc) => { doc.recipes[0].menuPriceInclVatCents = 100; }, /recipes\[0\]\.menuPriceInclVatCents.*prep/);
  assertRejects((doc) => { doc.recipes[0].vatRateBp = 900; }, /vatRateBp.*prep/);
  assertRejects((doc) => { doc.recipes[0].portions = 2; }, /portions.*prep/);
  assertRejects((doc) => { doc.recipes[0].monthlyVolume = 10; }, /monthlyVolume.*prep/);
  assertRejects((doc) => { doc.recipes[1].outputMilli = 1000; }, /outputMilli.*dish/);
  assertRejects((doc) => { doc.recipes[1].outputUnit = 'g'; }, /outputUnit.*dish/);
  assertRejects((doc) => { delete doc.recipes[0].outputMilli; }, /outputMilli/);
  assertRejects((doc) => { delete doc.recipes[1].menuPriceInclVatCents; }, /menuPriceInclVatCents/);
  assertRejects((doc) => { doc.recipes[1].kind = 'starter'; }, /kind/);
});

test('recipe lines have no own unit and only known fields', () => {
  assertRejects((doc) => { doc.recipes[0].lines[0].unit = 'kg'; }, /lines\[0\]\.unit.*unknown/i);
});

test('price history: seq strictly increasing, recordedAt not decreasing', () => {
  const twoPrices = (doc) => {
    doc.ingredients[0].prices.push({
      seq: 2, recordedAt: '2026-02-01T00:00:00.000Z', packPriceCents: 600, packSizeMilli: 1_000_000,
    });
  };
  assert.deepEqual(errorsOf(twoPrices), []);
  assertRejects((doc) => { twoPrices(doc); doc.ingredients[0].prices[1].seq = 1; }, /seq.*increas/);
  assertRejects((doc) => { twoPrices(doc); doc.ingredients[0].prices[1].recordedAt = '2025-12-31T00:00:00.000Z'; }, /recordedAt.*earlier/);
  assert.deepEqual(errorsOf((doc) => { twoPrices(doc); doc.ingredients[0].prices[1].recordedAt = doc.ingredients[0].prices[0].recordedAt; }), []);
});

test('line references must exist and match their kind', () => {
  assertRejects((doc) => { doc.recipes[0].lines[0].ref.id = 'nope'; }, /recipes\[0\]\.lines\[0\]\.ref\.id.*unknown ingredient/i);
  assertRejects((doc) => { doc.recipes[1].lines[0].ref.id = 'nope'; }, /unknown prep/i);
  assertRejects((doc) => { doc.recipes[0].lines[0].ref.kind = 'prep'; }, /ref/);
  assertRejects((doc) => { doc.recipes[1].lines[0].ref.kind = 'ingredient'; }, /unknown ingredient.*recipe/i);
  assertRejects((doc) => { doc.recipes[0].lines[0].ref.kind = 'dish'; }, /ref\.kind/);
});

test('a dish cannot be used as a prep line', () => {
  assertRejects((doc) => {
    doc.recipes.push(dish('d2', [line('l1', 'prep', 'd1')]));
  }, /d1.*dish.*cannot be used as a prep/i);
});

test('self reference and cycles are rejected', () => {
  assertRejects((doc) => { doc.recipes[0].lines.push(line('l2', 'prep', 'p1')); }, /cycle.*p1 -> p1/i);
  assertRejects((doc) => {
    doc.recipes.push(prep('pa', [line('l1', 'prep', 'pb')]), prep('pb', [line('l1', 'prep', 'pa')]));
  }, /cycle.*pa -> pb -> pa/i);
});

function chainDocument(depth) {
  const doc = smallDocument();
  doc.recipes = [];
  for (let level = 1; level <= depth; level += 1) {
    const child = level === 1 ? line('l1', 'ingredient', 'i1') : line('l1', 'prep', `p${level - 1}`);
    doc.recipes.push(prep(`p${level}`, [child]));
  }
  doc.recipes.push(dish('d1', [line('l1', 'prep', `p${depth}`)]));
  return doc;
}

test('prep nesting up to 5 levels is valid, 6 is rejected - same as the calc module', () => {
  const five = chainDocument(5);
  assert.deepEqual(validateDocument(five).errors, []);
  assert.doesNotThrow(() => recipeCost(five.recipes.at(-1), five));

  const six = chainDocument(6);
  assert.ok(validateDocument(six).errors.some((message) => /depth.*5/i.test(message)));
  assert.throws(() => recipeCost(six.recipes.at(-1), six), /depth/i);
});

test('scenario: shared contract is accepted and checked', () => {
  const base = smallDocument();
  const good = makeScenario(base, 'd1', {
    menuPriceInclVatCents: 1200, monthlyVolume: null, ingredientPriceCents: { i1: 700 }, lineQtyMilli: { l1: 2000 },
  });
  assert.deepEqual(validateScenario(good).errors, []);
  assert.deepEqual(validateDocument({ ...base, scenarios: [good] }).errors, []);

  const check = (mutate, pattern) => {
    const scenario = clone(good);
    mutate(scenario);
    const errors = validateScenario(scenario).errors;
    assert.ok(errors.some((message) => pattern.test(message)), `${pattern}: ${errors.join(' | ')}`);
  };
  check((s) => { s.recipeId = 'p1'; }, /recipeId.*dish/);
  check((s) => { s.baseline.recipeId = 'other'; }, /baseline\.recipeId/);
  check((s) => { s.baseline.takenAt = 'yesterday'; }, /takenAt/);
  check((s) => { s.baseline.recipes = s.baseline.recipes.filter((r) => r.kind === 'dish'); }, /unknown prep/i);
  check((s) => { s.baseline.recipes[0].lines.push(line('lx', 'prep', s.baseline.recipes[0].id)); }, /cycle/i);
  check((s) => { s.baseline.ingredients[0].prices[0].packSizeMilli = 0; }, /baseline\.ingredients\[0\]/);
  check((s) => { s.overrides.menuPriceInclVatCents = 12.5; }, /overrides\.menuPriceInclVatCents/);
  check((s) => { s.overrides.monthlyVolume = -3; }, /overrides\.monthlyVolume/);
  check((s) => { s.overrides.ingredientPriceCents.ghost = 100; }, /ingredientPriceCents\.ghost.*not in the baseline/);
  check((s) => { s.overrides.ingredientPriceCents.i1 = -1; }, /ingredientPriceCents\.i1/);
  check((s) => { s.overrides.lineQtyMilli.ghost = 100; }, /lineQtyMilli\.ghost.*top-level line/);
  check((s) => { s.overrides.lineQtyMilli.l1 = 0; }, /lineQtyMilli\.l1/);
  check((s) => { s.name = ''; }, /name/);
});

test('scenario ids must be unique and entity validators are reusable', () => {
  const base = smallDocument();
  base.scenarios = [makeScenario(base, 'd1'), makeScenario(base, 'd1')];
  assert.ok(validateDocument(base).errors.some((message) => /duplicate id/i.test(message)));
  assert.deepEqual(validateIngredient(ingredient('x')).errors, []);
  assert.ok(validateIngredient({ id: 'x' }, 'ingredient').errors.length > 0);
  assert.deepEqual(validateRecipe(prep('x', [])).errors, []);
});
