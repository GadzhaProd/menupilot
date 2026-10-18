import {
  LIMITS, checkArray, checkId, checkInstant, checkInt, checkKeys, checkSize, checkText, checkUniqueIds,
  fail, field, isObject, toResult,
} from './check.js';
import { checkCatalog } from './entities.js';
import { indexRecipes, reachableFrom } from './graph.js';

const OVERRIDE_FIELDS = ['menuPriceInclVatCents', 'monthlyVolume', 'ingredientPriceCents', 'lineQtyMilli'];

const isSet = (value) => value !== undefined && value !== null;

/** The baseline holds exactly the dish and the preps and ingredients reachable from it. */
function checkBaselineIsMinimal(baseline, path, errors) {
  const recipeById = indexRecipes(baseline.recipes);
  if (recipeById.get(baseline.recipeId)?.kind !== 'dish') {
    fail(errors, field(path, 'recipeId'), `'${baseline.recipeId}' must be a dish in the baseline`);
    return;
  }
  const { recipeIds, ingredientIds } = reachableFrom(recipeById, baseline.recipeId);
  baseline.recipes.forEach((recipe, index) => {
    if (!recipeIds.has(recipe.id)) {
      fail(errors, `${field(path, 'recipes')}[${index}]`, `'${recipe.id}' is not used by the dish`);
    }
  });
  baseline.ingredients.forEach((ingredient, index) => {
    if (!ingredientIds.has(ingredient.id)) {
      fail(errors, `${field(path, 'ingredients')}[${index}]`, `'${ingredient.id}' is not used by the dish`);
    }
  });
}

/** Baseline snapshot: a mini document { takenAt, recipeId, ingredients, recipes }. */
export function checkBaseline(baseline, path, errors, ctx = {}) {
  if (!isObject(baseline)) {
    fail(errors, path, 'must be an object');
    return;
  }
  checkKeys(baseline, ['takenAt', 'recipeId', 'ingredients', 'recipes'], path, errors);
  checkInstant(baseline.takenAt, field(path, 'takenAt'), errors);
  checkId(baseline.recipeId, field(path, 'recipeId'), errors);
  const before = errors.length;
  checkCatalog(baseline, path, errors, ctx);
  if (errors.length === before) {
    checkBaselineIsMinimal(baseline, path, errors);
  }
}

function checkPriceOverrides(map, baseline, path, errors) {
  if (!isObject(map)) {
    fail(errors, path, 'must be an object of ingredient id -> pack price in cents');
    return;
  }
  const known = new Set(Array.isArray(baseline?.ingredients) ? baseline.ingredients.map((entry) => entry?.id) : []);
  for (const [id, value] of Object.entries(map)) {
    if (!known.has(id)) {
      fail(errors, field(path, id), 'ingredient is not in the baseline');
    } else if (isSet(value)) {
      checkInt(value, field(path, id), errors, 0);
    }
  }
}

function checkQuantityOverrides(map, baseline, path, errors) {
  if (!isObject(map)) {
    fail(errors, path, 'must be an object of line id -> quantity in thousandths');
    return;
  }
  const dish = Array.isArray(baseline?.recipes)
    ? baseline.recipes.find((recipe) => recipe?.id === baseline.recipeId)
    : null;
  const lineIds = new Set(Array.isArray(dish?.lines) ? dish.lines.map((entry) => entry?.id) : []);
  for (const [id, value] of Object.entries(map)) {
    if (!lineIds.has(id)) {
      fail(errors, field(path, id), 'not a top-level line of the baseline dish');
    } else if (isSet(value)) {
      checkInt(value, field(path, id), errors, 1);
    }
  }
}

function checkOverrides(overrides, baseline, path, errors) {
  if (!isObject(overrides)) {
    fail(errors, path, 'must be an object');
    return;
  }
  checkKeys(overrides, OVERRIDE_FIELDS, path, errors);
  if (isSet(overrides.menuPriceInclVatCents)) {
    checkInt(overrides.menuPriceInclVatCents, field(path, 'menuPriceInclVatCents'), errors, 0);
  }
  if (isSet(overrides.monthlyVolume)) {
    checkInt(overrides.monthlyVolume, field(path, 'monthlyVolume'), errors, 0);
  }
  if (isSet(overrides.ingredientPriceCents)) {
    checkPriceOverrides(overrides.ingredientPriceCents, baseline, field(path, 'ingredientPriceCents'), errors);
  }
  if (isSet(overrides.lineQtyMilli)) {
    checkQuantityOverrides(overrides.lineQtyMilli, baseline, field(path, 'lineQtyMilli'), errors);
  }
}

export function checkScenario(scenario, path, errors, ctx = {}) {
  if (!isObject(scenario)) {
    fail(errors, path, 'must be an object');
    return;
  }
  checkKeys(scenario, ['id', 'recipeId', 'name', 'createdAt', 'baseline', 'overrides'], path, errors);
  checkId(scenario.id, field(path, 'id'), errors);
  checkText(scenario.name, field(path, 'name'), errors);
  checkInstant(scenario.createdAt, field(path, 'createdAt'), errors);
  checkId(scenario.recipeId, field(path, 'recipeId'), errors);
  checkBaseline(scenario.baseline, field(path, 'baseline'), errors, ctx);
  if (isObject(scenario.baseline) && scenario.recipeId !== scenario.baseline.recipeId) {
    fail(errors, field(path, 'recipeId'), 'must be the dish of the baseline (baseline.recipeId)');
  }
  checkOverrides(scenario.overrides, scenario.baseline, field(path, 'overrides'), errors);
}

export function checkScenarios(scenarios, path, errors, ctx = {}) {
  if (checkArray(scenarios, path, errors) && checkSize(scenarios, LIMITS.scenarios, path, errors)) {
    scenarios.forEach((scenario, index) => checkScenario(scenario, `${path}[${index}]`, errors, ctx));
    checkUniqueIds(scenarios, path, errors);
  }
}

export function validateScenario(scenario, path = 'scenario', ctx = {}) {
  const errors = [];
  checkScenario(scenario, path, errors, ctx);
  return toResult(errors);
}
