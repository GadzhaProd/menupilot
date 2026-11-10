import assert from 'node:assert/strict';
import test from 'node:test';
import * as calc from '../../src/calc/costing.js';
import { dashboardData } from '../../src/calc/dashboard.js';
import { createBaselineSnapshot, simulate } from '../../src/calc/simulate.js';
import { smallDocument } from '../store/fixtures.js';

const prices = [
  { seq: 1, recordedAt: '2026-10-20T12:00:00Z', packPriceCents: 800, packSizeMilli: 1000000 },
  { seq: 2, recordedAt: '2026-10-01T00:00:00Z', packPriceCents: 200, packSizeMilli: 1000000 },
  { seq: 3, recordedAt: '2026-10-01T00:00:00Z', packPriceCents: 300, packSizeMilli: 1000000 },
];
test('history display is ordered by effective instant then sequence, without changing append order', () => {
  assert.equal(typeof calc.pricesNewestFirst, 'function');
  assert.deepEqual(calc.pricesNewestFirst(prices).map(p => p.seq), [1, 3, 2]);
  assert.deepEqual(prices.map(p => p.seq), [1, 2, 3]);
});
test('backdated history: current, between dates, ties, nested prep and simulator baseline agree', () => {
  for (const history of [prices, [...prices].reverse()]) {
    assert.equal(calc.selectPriceAtDate(history).seq, 1);
    assert.equal(calc.selectPriceAtDate(history, '2026-10-10T00:00:00Z').seq, 3);
    assert.equal(calc.selectPriceAtDate(history, '2026-09-30T23:59:59Z'), null);
  }
  const doc = smallDocument();
  doc.ingredients[0].prices = structuredClone(prices);
  doc.recipes[0].lines[0].netQtyMilli = 1000000;
  doc.recipes[1].lines[0].netQtyMilli = 1000000;
  doc.recipes[1].monthlyVolume = 100;
  const row = dashboardData(doc, '2026-10-10T23:59:59.999Z').dishes[0];
  assert.equal(row.currentCostMicro, 8000000n);
  assert.equal(row.comparisonCostMicro, 3000000n);
  assert.equal(row.costDeltaCents, 500n);
  assert.equal(row.monthlyImpactCents, -50000n);
  const baseline = createBaselineSnapshot(doc, 'd1', '2026-10-10T23:59:59.999Z');
  assert.equal(simulate(baseline, {}).recipeCostPerPortionMicro, row.comparisonCostMicro);
  assert.equal(simulate(createBaselineSnapshot(doc, 'd1', '2026-10-21T00:00:00Z'), {}).recipeCostPerPortionMicro, row.currentCostMicro);
});
