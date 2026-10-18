import assert from 'node:assert/strict';
import test from 'node:test';
import { metrics, recipeCost, selectPriceAtDate } from '../../src/calc/costing.js';
import { formatEURFromMicro } from '../../src/calc/money.js';
import { DEMO_REFERENCE_NOW, shiftDemoDates } from '../../src/store/demo.js';
import { validateDocument } from '../../src/store/schema.js';
import { daysBefore, readDemo } from './fixtures.js';

/*
 * How demo dates relate to "30 days ago"
 * --------------------------------------
 * data/demo.json is written as if "today" were DEMO_REFERENCE_NOW (2026-10-18T12:00:00Z).
 * Burger-related prices were recorded 75 days before that moment and changed
 * 14-21 days before it, so the Classic Burger costs EUR 4.20 on any date from
 * 60 to 30 days ago and EUR 4.85 today. The store shifts every demo timestamp by
 * (now - DEMO_REFERENCE_NOW) when it loads or resets the demo, so the same
 * numbers appear relative to the real current time.
 */

const burger = (doc) => doc.recipes.find((recipe) => recipe.name === 'Classic Burger');

function burgerNumbers(doc, now, daysAgo) {
  const dish = burger(doc);
  const oldCost = recipeCost(dish, doc, { asOf: daysBefore(now, daysAgo) }).costPerPortionMicro;
  const newCost = recipeCost(dish, doc, { asOf: now }).costPerPortionMicro;
  const input = { menuPriceInclVatCents: dish.menuPriceInclVatCents, vatRateBp: dish.vatRateBp, monthlyVolume: dish.monthlyVolume };
  return {
    oldCost,
    newCost,
    before: metrics({ ...input, recipeCostPerPortionMicro: oldCost }),
    after: metrics({ ...input, recipeCostPerPortionMicro: newCost }),
  };
}

test('demo.json is a valid document', () => {
  assert.deepEqual(validateDocument(readDemo()), { valid: true, errors: [] });
});

test('demo shape: 8-12 ingredients, 5-7 dishes, nested preps, one 21% drink', () => {
  const doc = readDemo();
  const dishes = doc.recipes.filter((recipe) => recipe.kind === 'dish');
  const preps = doc.recipes.filter((recipe) => recipe.kind === 'prep');
  assert.ok(doc.ingredients.length >= 8 && doc.ingredients.length <= 12);
  assert.ok(dishes.length >= 5 && dishes.length <= 7);
  const usedBy = (prepId) => dishes.filter((d) => d.lines.some((l) => l.ref.id === prepId)).length;
  assert.ok(preps.some((p) => usedBy(p.id) >= 2), 'a prep used by two dishes');
  assert.ok(preps.some((p) => p.lines.some((l) => l.ref.kind === 'prep')), 'a prep inside a prep');
  assert.ok(dishes.some((d) => d.vatRateBp === 2100), 'a 21% VAT drink');
  assert.equal(dishes.filter((d) => d.monthlyVolume === undefined).length, 1);
  assert.deepEqual(doc.scenarios, []);
  assert.ok(doc.ingredients.some((i) => i.prices.length >= 2), 'price history');
  assert.ok(doc.ingredients.some((i) => new Set(i.prices.map((p) => p.packSizeMilli)).size > 1), 'a pack size change');
});

test('Classic Burger reproduces the spec example: EUR 4.20 -> 4.85, -0.65 per portion, -195.00 per month', () => {
  const doc = readDemo();
  for (const daysAgo of [60, 45, 30]) {
    const { oldCost, newCost, before, after } = burgerNumbers(doc, DEMO_REFERENCE_NOW, daysAgo);
    assert.equal(oldCost, 4_200_000n);
    assert.equal(newCost, 4_850_000n);
    assert.equal(formatEURFromMicro(oldCost), '€4.20');
    assert.equal(formatEURFromMicro(newCost), '€4.85');
    assert.equal(before.priceExclVatMicro, 12_000_000n);
    assert.equal(before.contributionMicro, 7_800_000n);
    assert.equal(after.contributionMicro, 7_150_000n);
    assert.equal(before.monthlyContributionCents, 234_000n);
    assert.equal(after.monthlyContributionCents, 214_500n);
    assert.equal(after.monthlyContributionCents - before.monthlyContributionCents, -19_500n);
  }
  assert.equal(burger(doc).menuPriceInclVatCents, 1308);
  assert.equal(burger(doc).vatRateBp, 900);
  assert.equal(burger(doc).monthlyVolume, 300);
});

test('shifted demo gives the same numbers relative to a later "now"', () => {
  const later = '2027-06-01T08:30:00.000Z';
  const doc = shiftDemoDates(readDemo(), later);
  assert.deepEqual(validateDocument(doc).errors, []);
  const { oldCost, newCost } = burgerNumbers(doc, later, 30);
  assert.equal(oldCost, 4_200_000n);
  assert.equal(newCost, 4_850_000n);
  for (const ingredient of doc.ingredients) {
    const last = ingredient.prices.at(-1);
    assert.ok(Date.parse(last.recordedAt) <= Date.parse(later), 'no price from the future');
    assert.equal(selectPriceAtDate(ingredient.prices, later).seq, last.seq);
  }
});

test('shiftDemoDates does not change its input and keeps pack sizes and seq', () => {
  const original = readDemo();
  const snapshot = JSON.stringify(original);
  const shifted = shiftDemoDates(original, '2030-01-01T00:00:00.000Z');
  assert.equal(JSON.stringify(original), snapshot);
  assert.deepEqual(shifted.ingredients.map((i) => i.prices.map((p) => [p.seq, p.packPriceCents, p.packSizeMilli])),
    original.ingredients.map((i) => i.prices.map((p) => [p.seq, p.packPriceCents, p.packSizeMilli])));
});
