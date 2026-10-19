import { MICRO_EUROS_PER_CENT } from './constants.js';

const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Divide integers and round ties away from zero.
 * @param {bigint} numerator
 * @param {bigint} denominator
 * @returns {bigint}
 */
export function roundDiv(numerator, denominator) {
  if (typeof numerator !== 'bigint' || typeof denominator !== 'bigint') {
    throw new TypeError('roundDiv expects BigInt operands.');
  }
  if (denominator === 0n) {
    throw new RangeError('Cannot divide by zero.');
  }

  const isNegative = (numerator < 0n) !== (denominator < 0n);
  const absoluteNumerator = numerator < 0n ? -numerator : numerator;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;
  let quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  if (remainder * 2n >= absoluteDenominator) {
    quotient += 1n;
  }

  return isNegative ? -quotient : quotient;
}

/**
 * Parse a non-negative euro amount into safe integer cents.
 * Accepts a decimal comma or point and an optional leading euro sign. Thousands
 * separators and more than two fractional digits are rejected as ambiguous.
 * @param {string} input
 * @returns {number} Euro cents as a safe integer.
 */
export function parseMoneyToCents(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Enter money as text.');
  }

  let amount = input.trim();
  if (amount.startsWith('€')) {
    amount = amount.slice(1).trimStart();
  }
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(amount);
  if (!match) {
    throw new TypeError('Enter a non-negative amount with at most two decimal places.');
  }

  const fractionalCents = (match[2] ?? '').padEnd(2, '0');
  const cents = BigInt(match[1]) * 100n + BigInt(fractionalCents || '0');
  if (cents > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError('Money amount exceeds the safe integer range.');
  }

  return parseInt(cents.toString(), 10);
}

/**
 * Format safe integer cents (number or BigInt) as euros with two decimals.
 * @param {number|bigint} cents
 * @returns {string}
 */
export function formatEURFromCents(cents) {
  let centsBigInt;
  if (typeof cents === 'bigint') {
    centsBigInt = cents;
  } else if (typeof cents === 'number' && Number.isSafeInteger(cents)) {
    centsBigInt = BigInt(cents);
  } else {
    throw new TypeError('Cents must be a BigInt or safe integer.');
  }

  const isNegative = centsBigInt < 0n;
  const absoluteCents = isNegative ? -centsBigInt : centsBigInt;
  const euros = absoluteCents / 100n;
  const remainderCents = (absoluteCents % 100n).toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}€${euros}.${remainderCents}`;
}

/**
 * Round a micro-euro amount to displayed cents and format it as euros.
 * @param {bigint} microEuros
 * @returns {string}
 */
export function formatEURFromMicro(microEuros) {
  if (typeof microEuros !== 'bigint') {
    throw new TypeError('Micro-euros must be a BigInt.');
  }
  return formatEURFromCents(roundDiv(microEuros, MICRO_EUROS_PER_CENT));
}

// The UI supports two locales. Normalising regional tags bounds the cache to two entries.
const FORMAT_CACHE = new Map();
function localeFormats(locale) {
  const language = locale.toLowerCase().startsWith('nl') ? 'nl' : 'en';
  if (!FORMAT_CACHE.has(language)) {
    const tag = language === 'nl' ? 'nl-NL' : 'en-GB';
    const currency = new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const template = currency.formatToParts(1234.5);
    FORMAT_CACHE.set(language, {
      integer: new Intl.NumberFormat(tag, { useGrouping: true, maximumFractionDigits: 0 }),
      template,
      decimal: template.find((part) => part.type === 'decimal').value,
      date: new Intl.DateTimeFormat(language === 'nl' ? 'nl-NL' : 'en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
      }),
    });
  }
  return FORMAT_CACHE.get(language);
}

/** Format integer cents with locale separators while preserving the exact BigInt value.
 * Deliberate sign policy: minus precedes the euro sign in both languages:
 * EN -€273.38; NL -€ 273,38 (the Dutch currency space is non-breaking).
 * No value is converted from BigInt to Number. Intl objects/templates are cached by locale.
 * @param {number|bigint} cents
 * @param {string} [locale]
 * @returns {string}
 */
export function formatEURFromCentsLocale(cents, locale = 'en') {
  const amount = typeof cents === 'bigint' ? cents
    : typeof cents === 'number' && Number.isSafeInteger(cents) ? BigInt(cents) : null;
  if (amount === null) throw new TypeError('Cents must be a BigInt or safe integer.');

  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const euros = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  const { integer, template } = localeFormats(locale);
  const groupedEuros = integer.format(euros);
  let insertedInteger = false;
  return `${negative ? '-' : ''}${template.map((part) => {
    if (part.type === 'integer') {
      if (insertedInteger) return '';
      insertedInteger = true;
      return groupedEuros;
    }
    if (part.type === 'group') return '';
    if (part.type === 'fraction') return fraction;
    return part.value;
  }).join('')}`;
}

/** Format tenths of a percent as a localized string, without converting the value to Number.
 * @param {bigint|null} tenths
 * @param {string} [locale]
 * @returns {string}
 */
export function formatPercentTenthsLocale(tenths, locale = 'en') {
  if (tenths === null) return locale.startsWith('nl') ? 'n.v.t.' : 'n/a';
  const negative = tenths < 0n;
  const absolute = negative ? -tenths : tenths;
  const formats = localeFormats(locale);
  const integer = formats.integer.format(absolute / 10n);
  const decimal = formats.decimal;
  const fraction = (absolute % 10n).toString();
  return `${negative ? '-' : ''}${integer}${decimal}${fraction}%`;
}

/** @param {bigint|null} tenths @param {string} [locale] @returns {string} */
export function formatPointsLocale(tenths, locale = 'en') {
  if (tenths === null) return locale.startsWith('nl') ? 'n.v.t.' : 'n/a';
  const sign = tenths > 0n ? '+' : '';
  return `${sign}${formatPercentTenthsLocale(tenths, locale).replace('%', '')} pp`;
}

/** @param {string} iso @param {string} [locale] @returns {string} */
export function formatDateLocale(iso, locale = 'en') {
  return localeFormats(locale).date.format(new Date(iso));
}

/** Round micro-euros at the existing display boundary, then localise the exact cents.
 * @param {bigint} microEuros @param {string} [locale] @returns {string}
 */
export function formatEURFromMicroLocale(microEuros, locale = 'en') {
  return formatEURFromCentsLocale(roundDiv(microEuros, MICRO_EUROS_PER_CENT), locale);
}
