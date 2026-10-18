import test from 'node:test';
import assert from 'node:assert/strict';
import {
  averageFoodCostTenths,
  costChangeCents,
  foodCostChangeTenths,
  menuMonthlyImpactCents,
  monthlyImpactCents,
} from '../../src/calc/impact.js';

test('cost change subtracts displayed cents, as scenario comparison does', () => {
  assert.equal(costChangeCents(4_850_000n, 4_200_000n), 65n);
  assert.equal(costChangeCents(1_004_999n, 1_004_000n), 0n);
  assert.equal(costChangeCents(null, 1n), null);
});

test('food cost change subtracts displayed tenths', () => {
  assert.equal(foodCostChangeTenths(301n, 299n), 2n);
  assert.equal(foodCostChangeTenths(null, 299n), null);
});

test('monthly impact is current contribution minus comparison contribution', () => {
  assert.equal(monthlyImpactCents(-19_500n, 48_300n), -67_800n);
  assert.equal(monthlyImpactCents(null, 48_300n), null);
});

test('menu impact totals known values and rounds simple average half away from zero', () => {
  assert.equal(menuMonthlyImpactCents([-19_500n, null, 12_000n]), -7_500n);
  assert.equal(averageFoodCostTenths([10n, 11n]), 11n);
  assert.equal(averageFoodCostTenths([-10n, -11n]), -11n);
  assert.equal(averageFoodCostTenths([]), null);
});
