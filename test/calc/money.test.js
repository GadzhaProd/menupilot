import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatEURFromCents,
  formatEURFromMicro,
  parseMoneyToCents,
  roundDiv,
} from '../../src/calc/money.js';

test('parses supported euro amounts into safe integer cents', () => {
  assert.equal(parseMoneyToCents('12,50'), 1250);
  assert.equal(parseMoneyToCents('12.5'), 1250);
  assert.equal(parseMoneyToCents('€12'), 1200);
  assert.equal(parseMoneyToCents('€ 0,05'), 5);
});

test('rejects invalid, negative, ambiguous, and over-precise money input', () => {
  for (const input of ['abc', '-1', '', '1,234,5', '12.345', '€ 1.234,50', '1,234']) {
    assert.throws(() => parseMoneyToCents(input), { name: 'TypeError' }, input);
  }
  assert.throws(() => parseMoneyToCents(12), { name: 'TypeError' });
});

test('rejects parsed cent values outside the safe integer API range', () => {
  assert.equal(parseMoneyToCents('90071992547409.91'), Number.MAX_SAFE_INTEGER);
  assert.throws(() => parseMoneyToCents('90071992547409.92'), { name: 'RangeError' });
});

test('rounds half away from zero for positive and negative values', () => {
  assert.equal(roundDiv(1n, 2n), 1n);
  assert.equal(roundDiv(-1n, 2n), -1n);
  assert.equal(roundDiv(3n, 2n), 2n);
  assert.equal(roundDiv(-3n, 2n), -2n);
  assert.equal(roundDiv(1n, 3n), 0n);
  assert.equal(roundDiv(-1n, 3n), 0n);
  assert.equal(roundDiv(2n, -3n), -1n);
});

test('rejects division by zero and non-BigInt operands', () => {
  assert.throws(() => roundDiv(1n, 0n), { name: 'RangeError' });
  assert.throws(() => roundDiv(1, 2), { name: 'TypeError' });
});

test('formats cents and rounds micro-euros to cents only when displayed', () => {
  assert.equal(formatEURFromCents(1200), '€12.00');
  assert.equal(formatEURFromCents(-5n), '-€0.05');
  assert.equal(formatEURFromMicro(1_234_999n), '€1.23');
  assert.equal(formatEURFromMicro(1_235_000n), '€1.24');
  assert.equal(formatEURFromMicro(-5_000n), '-€0.01');
});

test('formats large BigInt values without precision loss', () => {
  assert.equal(formatEURFromCents(9_007_199_254_740_991n), '€90071992547409.91');
});
