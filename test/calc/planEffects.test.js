import test from 'node:test';
import assert from 'node:assert/strict';
import * as calc from '../../src/calc/planEffects.js';
import { dashboardData } from '../../src/calc/dashboard.js';
import { appendPrice } from '../../src/store/price.js';
import { smallDocument, dish, line, ingredient, deepFreeze } from '../store/fixtures.js';

const at = '2026-10-22T12:00:00.000Z';
test('combined proposal effects match Dashboard after all prices, with nested/shared ingredients and exclusions', () => {
  const before = smallDocument();
  before.recipes[0].lines.push(line('second', 'ingredient', 'i2', 123456, 8765));
  before.recipes[1].lines.push(line('direct', 'ingredient', 'i2', 34567));
  before.recipes[1].monthlyVolume = 123;
  before.recipes.push(dish('no-volume', [line('l', 'prep', 'p1', 456789)]));
  before.ingredients.push({ ...ingredient('unknown'), prices: [] });
  before.recipes.push({ ...dish('unknown-dish', [line('a', 'ingredient', 'unknown'), line('b', 'prep', 'p1')]), monthlyVolume: 50 });
  before.recipes.push(dish('unaffected', []));
  const after = structuredClone(before);
  appendPrice(after, 'i1', { packPriceCents: 1801, packSizeMilli: 1000000 }, at);
  appendPrice(after, 'i2', { packPriceCents: 713, packSizeMilli: 500000 }, at);
  const effects = calc.proposalEffects(deepFreeze(before), deepFreeze(after), ['i1', 'i2'], at);
  const dashboard = dashboardData(after, '2026-10-22T11:59:59.999Z');
  assert.deepEqual(effects.dishes.map(r => r.id), ['d1', 'no-volume', 'unknown-dish']);
  for (const row of effects.dishes) {
    const expected = dashboard.dishes.find(r => r.id === row.id);
    for (const key of ['currentCostMicro', 'comparisonCostMicro', 'foodCostDeltaTenthsPct', 'monthlyImpactCents']) assert.equal(row[key], expected[key], key);
  }
  assert.equal(effects.preps[0].currentBatchMicro, dashboard.preps[0].currentBatchMicro);
  assert.equal(effects.preps[0].comparisonBatchMicro, dashboard.preps[0].comparisonBatchMicro);
  assert.equal(effects.totalMonthlyImpactCents, dashboard.totalMonthlyImpactCents);
  assert.equal(effects.excludedWithoutVolume, 1);
  assert.equal(effects.excludedWithVolume, 1);
  assert.equal(effects.dishes[2].currentCostMicro, null);
  assert.equal(effects.dishes[2].status, 'cost-unknown');
  assert.equal(effects.dishes[1].monthlyImpactCents, null);
});
