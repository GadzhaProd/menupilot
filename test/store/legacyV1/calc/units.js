const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

const UNITS = {
  g: { baseUnit: 'g', family: 'mass', inputDecimals: 2, milliPerUnit: 1_000n },
  kg: { baseUnit: 'g', family: 'mass', inputDecimals: 3, milliPerUnit: 1_000_000n },
  ml: { baseUnit: 'ml', family: 'volume', inputDecimals: 2, milliPerUnit: 1_000n },
  l: { baseUnit: 'ml', family: 'volume', inputDecimals: 3, milliPerUnit: 1_000_000n },
  pc: { baseUnit: 'pc', family: 'piece', inputDecimals: 2, milliPerUnit: 1_000n },
};

/** Normalize an entered unit to its stored base unit: g, ml, or pc. */
function getUnitDefinition(unit) {
  if (typeof unit !== 'string') {
    throw new TypeError('Unit must be text.');
  }
  const key = unit.trim().toLowerCase();
  if (!Object.hasOwn(UNITS, key)) {
    throw new TypeError(`Unsupported unit: ${unit}.`);
  }
  return UNITS[key];
}

/**
 * Convert an entered unit to the stored base unit (kg→g, l→ml).
 * @param {string} enteredUnit One of g, kg, ml, l, or pc.
 * @returns {'g'|'ml'|'pc'}
 */
export function normalizeUnit(enteredUnit) {
  return getUnitDefinition(enteredUnit).baseUnit;
}

/**
 * Check whether two entered units belong to the same family.
 * @param {string} leftUnit
 * @param {string} rightUnit
 * @returns {boolean}
 */
export function areUnitsCompatible(leftUnit, rightUnit) {
  return getUnitDefinition(leftUnit).family === getUnitDefinition(rightUnit).family;
}

/**
 * Require two entered units to share a family and return their base unit.
 * @param {string} leftUnit
 * @param {string} rightUnit
 * @returns {'g'|'ml'|'pc'}
 * @throws {TypeError} If the units are unknown or from different families.
 */
export function assertCompatibleUnits(leftUnit, rightUnit) {
  const left = getUnitDefinition(leftUnit);
  const right = getUnitDefinition(rightUnit);
  if (left.family !== right.family) {
    throw new TypeError(`Unit mismatch: ${leftUnit} and ${rightUnit} are incompatible units.`);
  }
  return left.baseUnit;
}

/**
 * Return the conventional display suffix for a price normalized by unit.
 * @param {string} baseUnit Base or entered unit: g/kg, ml/l, or pc.
 * @returns {'/kg'|'/l'|'/pc'}
 */
export function unitPriceSuffix(baseUnit) {
  const normalizedUnit = normalizeUnit(baseUnit);
  if (normalizedUnit === 'g') {
    return '/kg';
  }
  if (normalizedUnit === 'ml') {
    return '/l';
  }
  return '/pc';
}

/**
 * Parse a positive quantity string into thousandths of its stored base unit.
 * g/ml/pc accept up to 2 decimal places; kg/l accept up to 3. Decimal comma
 * and point are supported; thousands separators are not. The result is a safe
 * integer number of thousandths of the stored base unit.
 * @param {string} quantityText
 * @param {string} enteredUnit
 * @returns {{ unit: 'g'|'ml'|'pc', quantityMilli: number }}
 */
export function parseQuantityToMilli(quantityText, enteredUnit) {
  if (typeof quantityText !== 'string') {
    throw new TypeError('Enter quantity as text.');
  }
  const definition = getUnitDefinition(enteredUnit);
  const match = /^(\d+)(?:[.,](\d+))?$/.exec(quantityText.trim());
  if (!match) {
    throw new TypeError('Enter a positive quantity with a decimal comma or point.');
  }

  const fractionalPart = match[2] ?? '';
  if (fractionalPart.length > definition.inputDecimals) {
    const precision = definition.inputDecimals === 2
      ? 'Use at most 2 decimals for g/ml/pc; do not use thousands separators.'
      : 'Use at most 3 decimals for kg/l; do not use thousands separators.';
    throw new TypeError(precision);
  }

  const decimalScale = 10n ** BigInt(definition.inputDecimals);
  const milliPerDecimalStep = definition.milliPerUnit / decimalScale;
  const fraction = BigInt(fractionalPart.padEnd(definition.inputDecimals, '0') || '0');
  const quantityMilli = BigInt(match[1]) * definition.milliPerUnit
    + fraction * milliPerDecimalStep;
  if (quantityMilli === 0n) {
    throw new TypeError('Quantity must be greater than zero.');
  }
  if (quantityMilli > MAX_SAFE_INTEGER_BIGINT) {
    throw new RangeError('Quantity exceeds the safe integer range.');
  }

  return {
    unit: definition.baseUnit,
    quantityMilli: parseInt(quantityMilli.toString(), 10),
  };
}
