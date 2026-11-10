import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardData } from '../../src/calc/dashboard.js';
import { smallDocument, ingredient, line, prep, markPriceDocument } from '../store/fixtures.js';

const asOf = '2025-12-31T23:59:59.999Z';
test('Dashboard lists every ingredient missing a comparison price through nested and repeated preps', () => {
  const doc = smallDocument();
  doc.ingredients.push(ingredient('i3'), ingredient('i4'));
  doc.recipes[0].lines.push(line('l2', 'ingredient', 'i2'));
  doc.recipes.push(prep('p2', [line('l1', 'prep', 'p1'), line('l2', 'ingredient', 'i3')]));
  doc.recipes[1].lines = [line('l1', 'prep', 'p2'), line('l2', 'prep', 'p1'), line('l3', 'ingredient', 'i4'), line('l4', 'ingredient', 'i1')];
  const missing = ids => ids.map(id => ({ id, name: id }));
  const result = () => dashboardData(doc, asOf).dishes[0];
  assert.equal(result().status, 'no-price-on-date');
  assert.deepEqual(result().missingPrices, missing(['i1', 'i2', 'i3', 'i4']));
  doc.ingredients[0].prices.push({ ...doc.ingredients[0].prices[0], seq: 2, recordedAt: asOf });
  assert.equal(result().status, 'no-price-on-date');
  assert.deepEqual(result().missingPrices, missing(['i2', 'i3', 'i4']));
  for (const item of doc.ingredients.slice(1)) item.prices.push({ ...item.prices[0], seq: 2, recordedAt: asOf });
  assert.equal(result().status, 'ready');
  assert.deepEqual(result().missingPrices, []);
});
test('an ingredient without any price remains cost unknown, never zero', () => {
  const doc = smallDocument();
  doc.ingredients[0].prices = [];
  const row = dashboardData(doc, asOf).dishes[0];
  assert.equal(row.status, 'cost-unknown');
  assert.equal(row.currentCostMicro, null);
  assert.deepEqual(row.missingPrices, [{ id: 'i1', name: 'i1' }]);
});


test('Mark: adding only beef leaves prep ingredients missing; all invoice prices give minus EUR 135', () => {
  const doc = markPriceDocument();
  const comparisonDate = '2026-10-11T23:59:59.999Z';
  const append = (item, cents) => item.prices.push({ ...item.prices[0], seq: 2, packPriceCents: cents, recordedAt: '2026-10-10T00:00:00.000Z' });
  append(doc.ingredients[0], 1700);
  const row = () => dashboardData(doc, comparisonDate).dishes[0];
  assert.equal(row().status, 'no-price-on-date');
  assert.deepEqual(row().missingPrices.map(i => i.id), ['bun', 'cheese', 'tomato', 'onion']);
  for (const item of doc.ingredients.slice(1)) append(item, item.prices[0].packPriceCents);
  assert.deepEqual(row().missingPrices, []);
  assert.equal(row().status, 'ready');
  assert.equal(row().monthlyImpactCents, -13500n);
});
