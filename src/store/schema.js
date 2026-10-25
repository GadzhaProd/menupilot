import {
  checkInt, checkKeys, fail, isObject, toResult,
} from './check.js';
import { StoreError } from './errors.js';
import { checkCatalog, validateIngredient, validateRecipe } from './entities.js';
import { checkScenarios, validateScenario } from './scenario.js';

// Domain schema version; independent of the storage/backup envelope schemaVersion.
export const FORMAT_VERSION = 1;

/** Price records may be this far ahead of the supplied clock (device clock drift). */
export const FUTURE_TOLERANCE_MS = 5 * 60_000;

function futureLimit(now) {
  return new Date(new Date(now).getTime() + FUTURE_TOLERANCE_MS).toISOString();
}
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
 * Returns `{ valid, errors }` where each error is "path: message"; invalid input
 * never throws. Size limits are in LIMITS (check.js).
 * With `options.now` (Date, epoch ms or ISO string), a price `recordedAt` more than
 * FUTURE_TOLERANCE_MS (5 minutes) after it is an error; without it, dates are not compared to a clock.
 * @param {unknown} doc
 * @param {{ now?: Date|number|string }} [options]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDocument(doc, { now } = {}) {
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
  const ctx = now === undefined ? {} : { latestRecordedAt: futureLimit(now) };
  checkCatalog(doc, '', errors, ctx);
  checkScenarios(doc.scenarios, 'scenarios', errors, ctx);
  return toResult(errors);
}

function structuredValidationDetails(doc, errors) {
  if (!isObject(doc)) return [];
  return errors.flatMap(detail => {
    const match = /^(ingredients|recipes)\[(\d+)\](?:\.[^:]+)?: (.*)$/.exec(detail);
    if (!match) return [];
    const [ , collection, indexText, message ] = match;
    const entity = doc[collection]?.[Number(indexText)];
    if (!isObject(entity)) return [];
    let code = null;
    let relatedNames;
    let relatedId;
    if (collection === 'ingredients' && detail.includes('.packPriceCents: must be an integer of at least 0')) code = 'negative-price';
    else if (collection === 'recipes' && message.startsWith('prep nesting depth')) code = 'prep-depth';
    else if (collection === 'recipes' && message.startsWith('prep cycle ')) {
      code = 'prep-cycle';
      relatedNames = message.slice('prep cycle '.length).split(' -> ');
    } else if (collection === 'recipes' && message.startsWith('unknown ingredient ')) {
      code = 'unknown-ingredient';
      relatedId = /^unknown ingredient '([^']+)'/.exec(message)?.[1];
    }
    if (!code) return [];
    return [{
      path: detail.slice(0, detail.indexOf(': ')), code,
      entityKind: collection === 'ingredients' ? 'ingredient' : entity.kind === 'prep' ? 'prep' : 'recipe',
      entityId: typeof entity.id === 'string' ? entity.id : undefined,
      entityName: typeof entity.name === 'string' ? entity.name : undefined,
      ...(relatedNames ? { relatedNames } : {}),
      ...(relatedId ? { relatedId } : {}),
    }];
  });
}

/**
 * Like validateDocument but throws StoreError("invalid") listing the first problems.
 * @param {unknown} doc
 * @param {{ now?: Date|number|string }} [options]
 */
export function assertValidDocument(doc, options) {
  const { valid, errors } = validateDocument(doc, options);
  if (!valid) {
    const shown = errors.slice(0, 3).join('; ');
    const more = errors.length > 3 ? ` (and ${errors.length - 3} more)` : '';
    throw new StoreError('invalid', `The data is not valid: ${shown}${more}`, errors, structuredValidationDetails(doc, errors));
  }
}
