import {
  checkInt, checkKeys, fail, isObject, toResult,
} from './check.js';
import { StoreError } from './errors.js';
import { checkCatalog, validateIngredient, validateRecipe } from './entities.js';
import { checkScenarios, validateScenario } from './scenario.js';

export const FORMAT_VERSION = 1;
export { MAX_PREP_DEPTH } from './graph.js';
export { validateIngredient, validateRecipe, validateScenario };

/** A valid document with no data. */
export function emptyDocument() {
  return {
    version: FORMAT_VERSION,
    settings: { defaultVatRateBp: 900 },
    ingredients: [],
    recipes: [],
    scenarios: [],
  };
}

/**
 * Validate a whole MenuPilot document (03_ARCHITECTURE section 5).
 * Never throws; returns `{ valid, errors }` where each error is "path: message".
 * @param {unknown} doc
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDocument(doc) {
  const errors = [];
  if (!isObject(doc)) {
    errors.push('document must be an object');
    return toResult(errors);
  }
  if (doc.version !== FORMAT_VERSION) {
    fail(errors, 'version', `must be ${FORMAT_VERSION} (found ${JSON.stringify(doc.version) ?? 'nothing'})`);
    return toResult(errors);
  }
  checkKeys(doc, ['version', 'settings', 'ingredients', 'recipes', 'scenarios'], '', errors);
  if (isObject(doc.settings)) {
    checkKeys(doc.settings, ['defaultVatRateBp'], 'settings', errors);
    checkInt(doc.settings.defaultVatRateBp, 'settings.defaultVatRateBp', errors, 0, 10_000);
  } else {
    fail(errors, 'settings', 'must be an object');
  }
  checkCatalog(doc, '', errors);
  checkScenarios(doc.scenarios, 'scenarios', errors);
  return toResult(errors);
}

/**
 * Like validateDocument but throws StoreError("invalid") listing the first problems.
 * @param {unknown} doc
 */
export function assertValidDocument(doc) {
  const { valid, errors } = validateDocument(doc);
  if (!valid) {
    const shown = errors.slice(0, 3).join('; ');
    const more = errors.length > 3 ? ` (and ${errors.length - 3} more)` : '';
    throw new StoreError('invalid', `The data is not valid: ${shown}${more}`, errors);
  }
}
