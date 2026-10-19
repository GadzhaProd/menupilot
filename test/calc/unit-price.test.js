import assert from 'node:assert/strict';
import test from 'node:test';
import * as calc from '../../src/calc/costing.js';
import { formatEURFromCents } from '../../src/calc/money.js';

const packCases = [
  [1120, 1_000_000, 'g', 1120n, 'kg', '€11.20/kg'],
  [280, 250_000, 'kg', 1120n, 'kg', '€11.20/kg'],
  [280, 250_000, 'ml', 1120n, 'l', '€11.20/l'],
  [280, 4000, 'pc', 70n, 'pc', '€0.70/pc'],
  [1, 2000, 'pc', 1n, 'pc', '€0.01/pc'], // exact half cent rounds up
  [1, 2001, 'pc', 0n, 'pc', '€0.00/pc'],
  [0, 1000, 'l', 0n, 'l', '€0.00/l'],
  [Number.MAX_SAFE_INTEGER, 1, 'g', 9007199254740991000000n, 'kg', '€90071992547409910000.00/kg'],
];
const prepCases = [
  [1_800_000n, 1_000_000, 'g', 180n, 'kg', '€1.80/kg'],
  [1_800_000n, 1_000_000, 'l', 180n, 'l', '€1.80/l'],
  [1_500_000n, 2000, 'pc', 75n, 'pc', '€0.75/pc'],
  [5000n, 1000, 'pc', 1n, 'pc', '€0.01/pc'],
  [4999n, 1000, 'pc', 0n, 'pc', '€0.00/pc'],
  [0n, 1_000_000, 'kg', 0n, 'kg', '€0.00/kg'],
  [10n ** 30n, 1_000_000, 'ml', 10n ** 26n, 'l', '€1000000000000000000000000.00/l'],
];

test('legacy unit-price displays match golden values before extraction', () => {
  for (const [price, size, unit, , , expected] of packCases) assert.equal(calc.packUnitPriceDisplay(price, size, unit), expected);
  for (const [batch, size, unit, , , expected] of prepCases) assert.equal(calc.prepUnitCostDisplay(batch, size, unit), expected);
  assert.equal(calc.prepUnitCostDisplay(null, 1000, 'g'), null);
});
test('pack unit price exposes exact cents and display unit with identical rounding', () => {
  assert.equal(typeof calc.packUnitPriceCents, 'function');
  for (const [price, size, unit, cents, per, expected] of packCases) {
    const value = calc.packUnitPriceCents(price, size, unit);
    assert.deepEqual(value, { cents, per });
    assert.equal(`${formatEURFromCents(value.cents)}/${value.per}`, expected);
  }
});
test('prep unit cost exposes exact cents, preserves unknown, and never rounds batch first', () => {
  assert.equal(typeof calc.prepUnitCostCents, 'function');
  for (const [batch, size, unit, cents, per, expected] of prepCases) {
    const value = calc.prepUnitCostCents(batch, size, unit);
    assert.deepEqual(value, { cents, per });
    assert.equal(`${formatEURFromCents(value.cents)}/${value.per}`, expected);
  }
  assert.equal(calc.prepUnitCostCents(null, 1000, 'g'), null);
  // Rounding the batch to cents first would incorrectly give 0 cents/kg.
  assert.deepEqual(calc.prepUnitCostCents(4999n, 1000, 'g'), { cents: 500n, per: 'kg' });
});
test('numeric unit APIs preserve validation including invalid output with unknown cost', () => {
  assert.equal(typeof calc.packUnitPriceCents, 'function');
  assert.equal(typeof calc.prepUnitCostCents, 'function');
  for (const args of [[-1, 1000, 'g'], [1.5, 1000, 'g'], [1, 0, 'g'], [1, 1000, 'cup'], [Number.MAX_SAFE_INTEGER + 1, 1000, 'g']]) {
    assert.throws(() => calc.packUnitPriceCents(...args));
    assert.throws(() => calc.packUnitPriceDisplay(...args));
  }
  for (const args of [[-1n, 1000, 'g'], [1, 1000, 'g'], [null, 0, 'g'], [null, 1000, 'cup']]) {
    assert.throws(() => calc.prepUnitCostCents(...args));
    assert.throws(() => calc.prepUnitCostDisplay(...args));
  }
});
