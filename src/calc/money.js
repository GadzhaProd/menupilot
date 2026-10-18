const MICRO_EUROS_PER_CENT = 10_000n;
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
