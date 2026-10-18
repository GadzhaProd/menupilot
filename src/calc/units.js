const MAX_SAFE_INTEGER_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

const UNITS = {
  g: { baseUnit: 'g', family: 'mass', decimalPlaces: 3 },
  kg: { baseUnit: 'g', family: 'mass', decimalPlaces: 6 },
  ml: { baseUnit: 'ml', family: 'volume', decimalPlaces: 3 },
  l: { baseUnit: 'ml', family: 'volume', decimalPlaces: 6 },
  pc: { baseUnit: 'pc', family: 'piece', decimalPlaces: 3 },
};

/** Normalize an entered unit to its stored base unit: g, ml, or pc. */
function getUnitDefinition(unit) {
  if (typeof unit !== 'string') {
    throw new TypeError('Unit must be text.');
  }
  const definition = UNITS[unit.trim().toLowerCase()];
  if (!definition) {
    throw new TypeError(`Unsupported unit: ${unit}.`);
  }
  return definition;
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
 * Parse a positive quantity string into thousandths of its stored base unit.
 * g/ml/pc accept up to 3 decimal places; kg/l accept up to 6. Decimal comma
 * and point are supported. The result is a safe integer suitable for storage.
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
  if (fractionalPart.length > definition.decimalPlaces) {
    throw new TypeError(`Quantity supports at most ${definition.decimalPlaces} decimal places in ${enteredUnit}.`);
  }

  const scale = 10n ** BigInt(definition.decimalPlaces);
  const fraction = BigInt(fractionalPart.padEnd(definition.decimalPlaces, '0') || '0');
  const quantityMilli = BigInt(match[1]) * scale + fraction;
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
