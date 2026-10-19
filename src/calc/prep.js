import { formatEURFromCents, roundDiv } from './money.js';
import { normalizeUnit } from './units.js';
import {
  ingredientLineCostMicroInternal,
  safeInteger,
  validateLineAmounts,
} from './internal.js';
import { BASIS_POINTS, MICRO_EUROS_PER_CENT } from './constants.js';

const MAX_PREP_DEPTH = 5;

function lineCostFromPrepBatchMicro(line, prep, prepBatchCostMicroValue) {
  normalizeUnit(prep.outputUnit);
  validateLineAmounts(line);
  const outputMilli = safeInteger(prep.outputMilli, 'outputMilli', 1);
  if (prepBatchCostMicroValue === null) {
    return null;
  }

  return roundDiv(
    prepBatchCostMicroValue * BigInt(line.netQtyMilli) * BASIS_POINTS,
    outputMilli * BigInt(line.yieldBp),
  );
}

function calculateRecipeLinesCostMicro(recipe, data, options, prepStack, prepDepth) {
  if (!Array.isArray(recipe.lines)) {
    throw new TypeError('Recipe lines must be an array.');
  }
  if (recipe.lines.length === 0) {
    return null;
  }

  let totalCostMicro = 0n;
  let hasUnknownLine = false;
  for (const line of recipe.lines) {
    if (!line.ref || typeof line.ref.id !== 'string') {
      throw new TypeError('Recipe line must reference an ingredient or prep.');
    }

    let lineCostMicro;
    if (line.ref.kind === 'ingredient') {
      const ingredient = data.ingredients.find((entry) => entry.id === line.ref.id);
      if (!ingredient) {
        throw new TypeError(`Unknown ingredient reference: ${line.ref.id}.`);
      }
      lineCostMicro = ingredientLineCostMicroInternal(ingredient, line, options);
    } else if (line.ref.kind === 'prep') {
      const nestedPrep = data.recipes.find(
        (entry) => entry.id === line.ref.id && entry.kind === 'prep',
      );
      if (!nestedPrep) {
        throw new TypeError(`Unknown prep reference: ${line.ref.id}.`);
      }
      const nestedBatchCostMicro = calculatePrepBatchCostMicro(
        nestedPrep,
        data,
        options,
        prepStack,
        prepDepth,
      );
      lineCostMicro = lineCostFromPrepBatchMicro(line, nestedPrep, nestedBatchCostMicro);
    } else {
      throw new TypeError(`Unsupported recipe line reference kind: ${line.ref.kind}.`);
    }

    if (lineCostMicro === null) {
      hasUnknownLine = true;
    } else {
      totalCostMicro += lineCostMicro;
    }
  }

  return hasUnknownLine ? null : totalCostMicro;
}

function calculatePrepBatchCostMicro(prep, data, options, prepStack, prepDepth) {
  if (!prep || prep.kind !== 'prep' || typeof prep.id !== 'string') {
    throw new TypeError('Expected a prep recipe with an id.');
  }
  const cycleStart = prepStack.findIndex((entry) => entry.id === prep.id);
  if (cycleStart !== -1) {
    const cycle = prepStack.slice(cycleStart).map((entry) => entry.name || entry.id);
    cycle.push(prep.name || prep.id);
    throw new Error(`Prep cycle detected: ${cycle.join(' -> ')}.`);
  }

  const currentDepth = prepDepth + 1;
  if (currentDepth > MAX_PREP_DEPTH) {
    throw new Error(`Prep nesting exceeds maximum depth of ${MAX_PREP_DEPTH} at ${prep.name || prep.id}.`);
  }
  safeInteger(prep.outputMilli, 'outputMilli', 1);
  normalizeUnit(prep.outputUnit);

  return calculateRecipeLinesCostMicro(
    prep,
    data,
    options,
    [...prepStack, prep],
    currentDepth,
  );
}

/**
 * Calculate batch cost for a dish or prep without dividing by dish portions.
 * The function is an internal bridge used by recipeCost and the public prep API.
 * @param {{kind:string, lines:object[]}} recipe Dish or prep recipe.
 * @param {{ingredients:object[], recipes:object[]}} data Document arrays.
 * @param {{asOf?:string}} [options]
 * @returns {bigint|null} Batch cost in micro-euros, or null when unknown.
 */
export function recipeBatchCostMicro(recipe, data, options = {}) {
  if (!recipe || (recipe.kind !== 'dish' && recipe.kind !== 'prep')) {
    throw new TypeError('Expected a dish or prep recipe.');
  }
  if (!data || !Array.isArray(data.ingredients) || !Array.isArray(data.recipes)) {
    throw new TypeError('Calculation data must contain ingredients and recipes arrays.');
  }
  if (recipe.kind === 'prep') {
    return calculatePrepBatchCostMicro(recipe, data, options, [], 0);
  }
  return calculateRecipeLinesCostMicro(recipe, data, options, [], 0);
}

/**
 * Calculate the full batch cost of a prep, including nested prep recipes.
 * Cycles, unit mismatches, and nesting deeper than five prep levels throw errors.
 * @param {{kind:'prep', outputMilli:number, outputUnit:string, lines:object[]}} prep
 * @param {{ingredients:object[], recipes:object[]}} data Document arrays.
 * @param {{asOf?:string}} [options]
 * @returns {bigint|null} Batch cost in micro-euros, or null when unknown.
 */
export function batchCostMicro(prep, data, options = {}) {
  if (!prep || prep.kind !== 'prep') {
    throw new TypeError('batchCostMicro expects a prep recipe.');
  }
  return recipeBatchCostMicro(prep, data, options);
}

/**
 * Calculate a recipe line that references a prep batch.
 * @param {{ref:{kind:'prep', id:string}, netQtyMilli:number, yieldBp:number}} line Quantity uses the prep output base unit.
 * @param {{kind:'prep', id:string, outputMilli:number, outputUnit:string, lines:object[]}} prep
 * @param {{ingredients:object[], recipes:object[]}} data Document arrays.
 * @param {{asOf?:string}} [options]
 * @returns {bigint|null} Line cost in micro-euros, or null when unknown.
 */
export function prepLineCostMicro(line, prep, data, options = {}) {
  if (!line?.ref || line.ref.kind !== 'prep' || line.ref.id !== prep?.id) {
    throw new TypeError('Prep line must reference the supplied prep.');
  }
  const batchCost = batchCostMicro(prep, data, options);
  return lineCostFromPrepBatchMicro(line, prep, batchCost);
}

/**
 * Prep batch cost per kg, l, or pc in exact display cents, rounded once.
 * @param {bigint|null} knownBatchCostMicro Prep batch cost in micro-euros.
 * @param {number} outputMilli Prep yield in thousandths of the output base unit.
 * @param {string} outputUnit Prep output unit: g/kg, ml/l, or pc.
 * @returns {{cents: bigint, per: 'kg'|'l'|'pc'}|null} Null when the batch cost is unknown.
 */
export function prepUnitCostCents(knownBatchCostMicro, outputMilli, outputUnit) {
  const sizeMilli = safeInteger(outputMilli, 'outputMilli', 1);
  const baseUnit = normalizeUnit(outputUnit);
  if (knownBatchCostMicro === null) {
    return null;
  }
  if (typeof knownBatchCostMicro !== 'bigint' || knownBatchCostMicro < 0n) {
    throw new TypeError('Prep batch cost must be a non-negative BigInt or null.');
  }

  const displayFactorMilli = baseUnit === 'pc' ? 1_000n : 1_000_000n;
  const unitPriceCents = roundDiv(
    knownBatchCostMicro * displayFactorMilli,
    sizeMilli * MICRO_EUROS_PER_CENT,
  );
  return { cents: unitPriceCents, per: baseUnit === 'g' ? 'kg' : baseUnit === 'ml' ? 'l' : 'pc' };
}

/** Legacy EN display; numeric calculation and rounding stay in prepUnitCostCents.
 * @param {bigint|null} knownBatchCostMicro @param {number} outputMilli @param {string} outputUnit
 * @returns {string|null}
 */
export function prepUnitCostDisplay(knownBatchCostMicro, outputMilli, outputUnit) {
  const value = prepUnitCostCents(knownBatchCostMicro, outputMilli, outputUnit);
  return value === null ? null : `${formatEURFromCents(value.cents)}/${value.per}`;
}
