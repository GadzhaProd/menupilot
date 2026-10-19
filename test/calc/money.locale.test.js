import assert from 'node:assert/strict';
import test from 'node:test';
import * as money from '../../src/calc/money.js';

test('locale cents: exact BigInt grouping and deliberate leading minus', () => {
  assert.equal(typeof money.formatEURFromCentsLocale, 'function');
  const format = money.formatEURFromCentsLocale;
  assert.equal(format(0n, 'en'), '€0.00');
  assert.equal(format(214500n, 'en'), '€2,145.00');
  assert.equal(format(214500n, 'nl'), '€\u00a02.145,00');
  assert.equal(format(-27338n, 'en'), '-€273.38');
  assert.equal(format(-27338n, 'nl'), '-€\u00a0273,38');
  assert.equal(format(9007199254740991n, 'en'), '€90,071,992,547,409.91');
  assert.equal(format(10n ** 30n + 1n, 'nl'), '€\u00a010.000.000.000.000.000.000.000.000.000,01');
  for (const invalid of [null, NaN, Infinity, 1.2, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => format(invalid, 'nl'), TypeError);
  }
});

test('locale micro-euros preserve half-away rounding, percentages and pp support unknown', () => {
  assert.equal(typeof money.formatEURFromMicroLocale, 'function');
  assert.equal(money.formatEURFromMicroLocale(-5000n, 'nl'), '-€\u00a00,01');
  assert.equal(money.formatPercentTenthsLocale(-5n, 'en'), '-0.5%');
  assert.equal(money.formatPercentTenthsLocale(-5n, 'nl'), '-0,5%');
  assert.equal(money.formatPointsLocale(1234567n, 'nl'), '+123.456,7 pp');
  assert.equal(money.formatPointsLocale(-5n, 'en'), '-0.5 pp');
  assert.equal(money.formatPointsLocale(0n, 'nl'), '0,0 pp');
  for (const format of [money.formatPointsLocale, money.formatPercentTenthsLocale]) {
    assert.equal(format(null, 'nl'), 'n.v.t.');
    assert.equal(format(null, 'en'), 'n/a');
  }
  assert.equal(money.formatDateLocale('2026-10-04T23:00:00.000Z', 'en'), '4 Oct 2026');
  assert.equal(money.formatDateLocale('2026-10-04T23:00:00.000Z', 'nl'), '4 okt 2026');
});
