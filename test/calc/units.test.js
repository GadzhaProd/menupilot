import assert from 'node:assert/strict';
import test from 'node:test';
import {
  areUnitsCompatible,
  assertCompatibleUnits,
  normalizeUnit,
  parseQuantityToMilli,
} from '../../src/calc/units.js';

test('normalizes kg and l to their base units and scales all values to milli-units', () => {
  assert.deepEqual(parseQuantityToMilli('1', 'kg'), { unit: 'g', quantityMilli: 1_000_000 });
  assert.deepEqual(parseQuantityToMilli('1.5', 'l'), { unit: 'ml', quantityMilli: 1_500_000 });
  assert.deepEqual(parseQuantityToMilli('250', 'g'), { unit: 'g', quantityMilli: 250_000 });
  assert.deepEqual(parseQuantityToMilli('2.5', 'pc'), { unit: 'pc', quantityMilli: 2_500 });
});

test('parses comma decimals exactly without floating-point arithmetic', () => {
  assert.deepEqual(parseQuantityToMilli('0,125', 'kg'), { unit: 'g', quantityMilli: 125_000 });
  assert.deepEqual(parseQuantityToMilli('12,75', 'ml'), { unit: 'ml', quantityMilli: 12_750 });
});

test('normalizes input units and checks compatible unit families', () => {
  assert.equal(normalizeUnit('kg'), 'g');
  assert.equal(normalizeUnit('l'), 'ml');
  assert.equal(areUnitsCompatible('g', 'kg'), true);
  assert.equal(areUnitsCompatible('ml', 'l'), true);
  assert.equal(areUnitsCompatible('g', 'ml'), false);
  assert.equal(areUnitsCompatible('pc', 'g'), false);
  assert.equal(assertCompatibleUnits('kg', 'g'), 'g');
  assert.throws(() => assertCompatibleUnits('g', 'ml'), /incompatible units/i);
});

test('rejects invalid, negative, zero, and over-precise quantities', () => {
  for (const [value, unit] of [
    ['abc', 'g'],
    ['-1', 'kg'],
    ['', 'ml'],
    ['1,2.3', 'g'],
    ['1.2345', 'g'],
    ['1.0000001', 'kg'],
    ['0', 'pc'],
  ]) {
    assert.throws(() => parseQuantityToMilli(value, unit), { name: 'TypeError' }, `${value} ${unit}`);
  }
  assert.throws(() => parseQuantityToMilli('1', 'cup'), { name: 'TypeError' });
});

test('enforces safe integer milli-unit boundaries', () => {
  assert.equal(parseQuantityToMilli('9007199254740.991', 'g').quantityMilli, Number.MAX_SAFE_INTEGER);
  assert.throws(() => parseQuantityToMilli('9007199254740.992', 'g'), { name: 'RangeError' });
});
