import {
  checkArray, checkId, checkInstant, checkInt, checkKeys, checkText, checkUniqueIds, fail, field,
  instantNotAfter, isObject, toResult,
} from './check.js';
import { checkRecipeGraph } from './graph.js';

const BASE_UNITS = ['g', 'ml', 'pc'];
const DISH_FIELDS = ['menuPriceInclVatCents', 'vatRateBp', 'portions', 'monthlyVolume'];
const PREP_FIELDS = ['outputMilli', 'outputUnit'];
const MAX_BP = 10_000;

function isEarlier(a, b) {
  return instantNotAfter(a, b) && !instantNotAfter(b, a);
}

function checkPrices(prices, path, errors) {
  if (!checkArray(prices, path, errors)) {
    return;
  }
  let previousSeq = null;
  let previousAt = null;
  prices.forEach((price, index) => {
    const here = `${path}[${index}]`;
    if (!isObject(price)) {
      fail(errors, here, 'must be an object');
      return;
    }
    checkKeys(price, ['seq', 'recordedAt', 'packPriceCents', 'packSizeMilli'], here, errors);
    const seqOk = checkInt(price.seq, field(here, 'seq'), errors, 1);
    const timeOk = checkInstant(price.recordedAt, field(here, 'recordedAt'), errors);
    checkInt(price.packPriceCents, field(here, 'packPriceCents'), errors, 0);
    checkInt(price.packSizeMilli, field(here, 'packSizeMilli'), errors, 1);
    if (seqOk) {
      if (previousSeq !== null && price.seq <= previousSeq) {
        fail(errors, field(here, 'seq'), `must be strictly increasing (previous seq is ${previousSeq})`);
      }
      previousSeq = price.seq;
    }
    if (timeOk) {
      if (previousAt !== null && isEarlier(price.recordedAt, previousAt)) {
        fail(errors, field(here, 'recordedAt'), `must not be earlier than the previous record (${previousAt})`);
      }
      previousAt = price.recordedAt;
    }
  });
}

export function checkIngredient(ingredient, path, errors) {
  if (!isObject(ingredient)) {
    fail(errors, path, 'must be an object');
    return;
  }
  checkKeys(ingredient, ['id', 'name', 'unit', 'prices'], path, errors);
  checkId(ingredient.id, field(path, 'id'), errors);
  checkText(ingredient.name, field(path, 'name'), errors);
  if (!BASE_UNITS.includes(ingredient.unit)) {
    fail(errors, field(path, 'unit'), 'must be g, ml or pc (kg and l are converted when entered)');
  }
  checkPrices(ingredient.prices, field(path, 'prices'), errors);
}

function checkLine(line, path, errors) {
  if (!isObject(line)) {
    fail(errors, path, 'must be an object');
    return;
  }
  checkKeys(line, ['id', 'ref', 'netQtyMilli', 'yieldBp'], path, errors);
  checkId(line.id, field(path, 'id'), errors);
  checkInt(line.netQtyMilli, field(path, 'netQtyMilli'), errors, 1);
  checkInt(line.yieldBp, field(path, 'yieldBp'), errors, 1, MAX_BP);
  const refPath = field(path, 'ref');
  if (!isObject(line.ref)) {
    fail(errors, refPath, 'must be an object like { kind, id }');
    return;
  }
  checkKeys(line.ref, ['kind', 'id'], refPath, errors);
  if (line.ref.kind !== 'ingredient' && line.ref.kind !== 'prep') {
    fail(errors, field(refPath, 'kind'), 'must be ingredient or prep');
  }
  checkId(line.ref.id, field(refPath, 'id'), errors);
}

function checkLines(lines, path, errors) {
  if (!checkArray(lines, path, errors)) {
    return;
  }
  lines.forEach((line, index) => checkLine(line, `${path}[${index}]`, errors));
  const seen = new Set();
  lines.forEach((line, index) => {
    if (isObject(line) && typeof line.id === 'string') {
      if (seen.has(line.id)) {
        fail(errors, `${path}[${index}].id`, `duplicate line id '${line.id}'`);
      }
      seen.add(line.id);
    }
  });
}

export function checkRecipe(recipe, path, errors) {
  if (!isObject(recipe)) {
    fail(errors, path, 'must be an object');
    return;
  }
  const { kind } = recipe;
  const isDish = kind === 'dish';
  const isPrep = kind === 'prep';
  const notHere = {};
  const wrongKind = isDish ? PREP_FIELDS : DISH_FIELDS;
  if (isDish || isPrep) {
    wrongKind.forEach((key) => { notHere[key] = `not allowed on a ${kind}`; });
  }
  const allowed = ['id', 'name', 'kind', 'lines', ...(isDish ? DISH_FIELDS : []), ...(isPrep ? PREP_FIELDS : [])];
  checkKeys(recipe, allowed, path, errors, notHere);
  checkId(recipe.id, field(path, 'id'), errors);
  checkText(recipe.name, field(path, 'name'), errors);
  checkLines(recipe.lines, field(path, 'lines'), errors);
  if (!isDish && !isPrep) {
    fail(errors, field(path, 'kind'), 'must be dish or prep');
  } else if (isDish) {
    checkInt(recipe.menuPriceInclVatCents, field(path, 'menuPriceInclVatCents'), errors, 0);
    checkInt(recipe.vatRateBp, field(path, 'vatRateBp'), errors, 0, MAX_BP);
    checkInt(recipe.portions, field(path, 'portions'), errors, 1);
    if (recipe.monthlyVolume !== undefined && recipe.monthlyVolume !== null) {
      checkInt(recipe.monthlyVolume, field(path, 'monthlyVolume'), errors, 0);
    }
  } else {
    checkInt(recipe.outputMilli, field(path, 'outputMilli'), errors, 1);
    if (!BASE_UNITS.includes(recipe.outputUnit)) {
      fail(errors, field(path, 'outputUnit'), 'must be g, ml or pc');
    }
  }
}

/** Check `{ ingredients, recipes }` as a whole: entities, unique ids, references, cycles, depth. */
export function checkCatalog(catalog, path, errors) {
  const ingredientsPath = field(path, 'ingredients');
  const recipesPath = field(path, 'recipes');
  const ingredientsOk = checkArray(catalog.ingredients, ingredientsPath, errors);
  const recipesOk = checkArray(catalog.recipes, recipesPath, errors);
  if (ingredientsOk) {
    catalog.ingredients.forEach((entry, index) => checkIngredient(entry, `${ingredientsPath}[${index}]`, errors));
    checkUniqueIds(catalog.ingredients, ingredientsPath, errors);
  }
  if (recipesOk) {
    catalog.recipes.forEach((entry, index) => checkRecipe(entry, `${recipesPath}[${index}]`, errors));
    checkUniqueIds(catalog.recipes, recipesPath, errors);
  }
  if (ingredientsOk && recipesOk) {
    checkRecipeGraph(catalog, path, errors);
  }
}

export function validateIngredient(ingredient, path = 'ingredient') {
  const errors = [];
  checkIngredient(ingredient, path, errors);
  return toResult(errors);
}

export function validateRecipe(recipe, path = 'recipe') {
  const errors = [];
  checkRecipe(recipe, path, errors);
  return toResult(errors);
}
