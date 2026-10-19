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

test('all locale formatters normalize case/regions and unsupported locales explicitly use EN', () => {
  assert.equal(money.normalizeLocale('NL'), 'nl');
  assert.equal(money.normalizeLocale('nl-BE'), 'nl');
  assert.equal(money.normalizeLocale('de-DE'), 'en');
  for (const locale of ['NL', 'NL-nl', 'nl-BE']) {
    assert.equal(money.formatPercentTenthsLocale(null, locale), 'n.v.t.');
    assert.equal(money.formatPointsLocale(null, locale), 'n.v.t.');
    assert.equal(money.formatEURFromCentsLocale(125n, locale), '€\u00a01,25');
  }
  assert.equal(money.formatPercentTenthsLocale(null, 'de-DE'), 'n/a');
  assert.equal(money.formatEURFromCentsLocale(125n, 'de-DE'), '€1.25');
});

test('invalid dates have a localized unavailable value instead of throwing during render', () => {
  for (const invalid of ['', 'not-a-date', '2026-99-99']) {
    assert.equal(money.formatDateLocale(invalid, 'en'), 'n/a');
    assert.equal(money.formatDateLocale(invalid, 'NL'), 'n.v.t.');
  }
});

test('Intl constructors are reused by normalized locale across all formatters', async (t) => {
  const numberFormat = Intl.NumberFormat;
  const dateFormat = Intl.DateTimeFormat;
  let numbers = 0; let dates = 0;
  t.after(() => { Intl.NumberFormat = numberFormat; Intl.DateTimeFormat = dateFormat; });
  Intl.NumberFormat = new Proxy(numberFormat, { construct(target, args) { numbers++; return Reflect.construct(target, args); } });
  Intl.DateTimeFormat = new Proxy(dateFormat, { construct(target, args) { dates++; return Reflect.construct(target, args); } });
  const fresh = await import('../../src/calc/money.js?intl-cache-test');
  for (const locale of ['en', 'en-GB', 'EN', 'de-DE', 'nl', 'NL', 'nl-BE']) {
    fresh.formatEURFromCentsLocale(123n, locale);
    fresh.formatPercentTenthsLocale(123n, locale);
    fresh.formatPointsLocale(123n, locale);
    fresh.formatDateLocale('2026-10-04', locale);
  }
  assert.equal(numbers, 4, 'currency template + integer, once per supported locale');
  assert.equal(dates, 2, 'one date formatter per supported locale');
});
