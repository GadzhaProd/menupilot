import { metrics, recipeCost, selectPriceAtDate } from './costing.js';
import { safeInteger } from './internal.js';
import { roundDiv } from './money.js';
import { MICRO_EUROS_PER_CENT } from './constants.js';

function copyRecipe(recipe) {
  return { ...recipe, lines: recipe.lines.map((line) => ({ ...line, ref: { ...line.ref } })) };
}

function reachableSnapshot(data, recipeId, takenAt) {
  if (!data || !Array.isArray(data.ingredients) || !Array.isArray(data.recipes)) {
    throw new TypeError('Data must contain ingredients and recipes arrays.');
  }
  selectPriceAtDate([], takenAt);
  const root = data.recipes.find((recipe) => recipe.id === recipeId);
  if (!root) throw new TypeError(`Unknown recipe: ${recipeId}.`);
  if (root.kind !== 'dish') throw new TypeError('Baseline recipe must be a dish.');

  const ingredients = new Map();
  const recipes = new Map();
  const visiting = new Set();
  function visit(recipe) {
    recipes.set(recipe.id, copyRecipe(recipe));
    if (recipe.kind === 'prep' && visiting.has(recipe.id)) {
      throw new Error(`Prep cycle detected at ${recipe.id}.`);
    }
    if (recipe.kind === 'prep') visiting.add(recipe.id);
    for (const line of recipe.lines) {
      if (line.ref?.kind === 'ingredient') {
        const ingredient = data.ingredients.find((item) => item.id === line.ref.id);
        if (!ingredient) throw new TypeError(`Unknown ingredient reference: ${line.ref.id}.`);
        ingredients.set(ingredient.id, { ...ingredient, prices: (ingredient.prices ?? []).map((price) => ({ ...price })) });
      } else if (line.ref?.kind === 'prep') {
        const prep = data.recipes.find((item) => item.id === line.ref.id && item.kind === 'prep');
        if (!prep) throw new TypeError(`Unknown prep reference: ${line.ref.id}.`);
        if (!visiting.has(prep.id) && !recipes.has(prep.id)) visit(prep);
      } else {
        throw new TypeError(`Unsupported recipe line reference kind: ${line.ref?.kind}.`);
      }
    }
    visiting.delete(recipe.id);
  }
  visit(root);
  return {
    takenAt,
    recipeId,
    ingredients: [...ingredients.values()],
    recipes: data.recipes.filter((recipe) => recipes.has(recipe.id)).map(copyRecipe),
  };
}

/** Build an immutable-by-convention mini-document containing a dish and all reachable inputs.
 * @param {{ingredients:object[], recipes:object[]}} data Full document.
 * @param {string} recipeId Dish id.
 * @param {string} takenAt Strict ISO timestamp with timezone.
 * @returns {{takenAt:string, recipeId:string, ingredients:object[], recipes:object[]}}
 */
export function createBaselineSnapshot(data, recipeId, takenAt) {
  if (typeof recipeId !== 'string') throw new TypeError('recipeId must be a string.');
  return reachableSnapshot(data, recipeId, takenAt);
}

function optionalOverride(overrides, key, original, minimum) {
  const value = overrides[key];
  if (value === undefined || value === null) return original;
  safeInteger(value, key, minimum);
  return value;
}

function validateOverrides(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('Overrides must be an object.');
  }
  for (const key of ['ingredientPriceCents', 'lineQtyMilli']) {
    const value = overrides[key];
    if (value !== undefined && value !== null && (typeof value !== 'object' || Array.isArray(value))) {
      throw new TypeError(`${key} must be an object.`);
    }
  }
}

/** Calculate scenario metrics from a baseline snapshot without changing it.
 * @param {{takenAt:string, recipeId:string, ingredients:object[], recipes:object[]}} baseline
 * @param {{menuPriceInclVatCents?:number|null, monthlyVolume?:number|null, ingredientPriceCents?:Record<string,number|null>, lineQtyMilli?:Record<string,number|null>}} overrides
 * @returns {object} Raw integer metrics, with monetary amounts in micro-euros and monthly cents.
 */
export function simulate(baseline, overrides = {}) {
  validateOverrides(overrides);
  const dish = baseline?.recipes?.find((recipe) => recipe.id === baseline.recipeId);
  if (!dish || dish.kind !== 'dish') throw new TypeError('Baseline must contain its dish recipe.');
  const lines = dish.lines.map((line) => ({ ...line, ref: { ...line.ref } }));
  const lineOverrides = overrides.lineQtyMilli ?? {};
  const lineById = new Map(lines.map((line) => [line.id, line]));
  for (const [lineId, quantity] of Object.entries(lineOverrides)) {
    const line = lineById.get(lineId);
    if (!line) {
      const isPrepLine = baseline.recipes.some((recipe) => recipe.kind === 'prep' && recipe.lines.some((entry) => entry.id === lineId));
      if (isPrepLine) throw new TypeError(`Quantity override is allowed only for a top-level dish line: ${lineId}.`);
      throw new TypeError(`Unknown line id: ${lineId}.`);
    }
    if (quantity !== null && quantity !== undefined) {
      safeInteger(quantity, `lineQtyMilli.${lineId}`, 1);
      line.netQtyMilli = quantity;
    }
  }
  const priceOverrides = overrides.ingredientPriceCents ?? {};
  const ingredients = baseline.ingredients.map((ingredient) => {
    if (!Object.hasOwn(priceOverrides, ingredient.id) || priceOverrides[ingredient.id] == null) return ingredient;
    const price = selectPriceAtDate(ingredient.prices ?? [], baseline.takenAt);
    if (!price) throw new TypeError(`Cannot override price for ${ingredient.id}: no price pack size exists at baseline date.`);
    const packPriceCents = priceOverrides[ingredient.id];
    safeInteger(packPriceCents, `ingredientPriceCents.${ingredient.id}`, 0);
    return { ...ingredient, prices: [...ingredient.prices].map((entry) => entry === price
      ? { ...entry, packPriceCents }
      : entry) };
  });
  for (const key of Object.keys(priceOverrides)) {
    if (!baseline.ingredients.some((ingredient) => ingredient.id === key)) {
      throw new TypeError(`Unknown ingredient id: ${key}.`);
    }
  }
  const scenarioDish = {
    ...dish,
    lines,
    menuPriceInclVatCents: optionalOverride(overrides, 'menuPriceInclVatCents', dish.menuPriceInclVatCents, 0),
  };
  const data = { ingredients, recipes: baseline.recipes.map((recipe) => recipe.id === dish.id ? scenarioDish : recipe) };
  const cost = recipeCost(scenarioDish, data, { asOf: baseline.takenAt });
  const monthlyVolume = optionalOverride(overrides, 'monthlyVolume', dish.monthlyVolume, 0);
  return {
    recipeId: baseline.recipeId,
    menuPriceInclVatCents: scenarioDish.menuPriceInclVatCents,
    vatRateBp: dish.vatRateBp,
    monthlyVolume: monthlyVolume ?? null,
    ...metrics({
      recipeCostPerPortionMicro: cost.costPerPortionMicro,
      menuPriceInclVatCents: scenarioDish.menuPriceInclVatCents,
      vatRateBp: dish.vatRateBp,
      monthlyVolume,
    }),
  };
}

/** Compare scenarios with baseline using differences between displayed cent values.
 * @param {object} baselineResult Result from simulate.
 * @param {object[]} scenarioResults Results from simulate.
 * @returns {{baseline:object, scenarios:{result:object, contributionDeltaCents:bigint|null, monthlyContributionDeltaCents:bigint|null}[]}}
 */
export function compare(baselineResult, scenarioResults) {
  if (!baselineResult || !Array.isArray(scenarioResults)) throw new TypeError('compare expects a baseline result and scenario result array.');
  const displayedContribution = (result) => result.contributionMicro === null
    ? null
    : roundDiv(result.contributionMicro, MICRO_EUROS_PER_CENT);
  return {
    baseline: baselineResult,
    scenarios: scenarioResults.map((result) => {
      const baselineContribution = displayedContribution(baselineResult);
      const scenarioContribution = displayedContribution(result);
      return {
        result,
        contributionDeltaCents: baselineContribution === null || scenarioContribution === null
          ? null
          : scenarioContribution - baselineContribution,
        monthlyContributionDeltaCents: baselineResult.monthlyContributionCents === null || result.monthlyContributionCents === null
          ? null
          : result.monthlyContributionCents - baselineResult.monthlyContributionCents,
      };
    }),
  };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

/** Check whether the current reachable recipe graph or its latest prices differ from baseline.
 * @param {object} baseline Snapshot returned by createBaselineSnapshot.
 * @param {{ingredients:object[], recipes:object[]}} currentData Current document.
 * @returns {boolean}
 */
export function isBaselineStale(baseline, currentData) {
  const current = reachableSnapshot(currentData, baseline.recipeId, baseline.takenAt);
  const baselineRecipes = [...baseline.recipes].sort((a, b) => a.id.localeCompare(b.id));
  const currentRecipes = [...current.recipes].sort((a, b) => a.id.localeCompare(b.id));
  if (JSON.stringify(canonical(baselineRecipes)) !== JSON.stringify(canonical(currentRecipes))) return true;
  const baselineIngredients = new Map(baseline.ingredients.map((item) => [item.id, item]));
  if (baselineIngredients.size !== current.ingredients.length) return true;
  for (const ingredient of current.ingredients) {
    const old = baselineIngredients.get(ingredient.id);
    if (!old) return true;
    if (old.unit !== ingredient.unit) return true;
    const oldPrice = selectPriceAtDate(old.prices ?? [], baseline.takenAt);
    const currentPrice = selectPriceAtDate(ingredient.prices ?? []);
    const details = (price) => price && ({ packPriceCents: price.packPriceCents, packSizeMilli: price.packSizeMilli });
    if (JSON.stringify(details(oldPrice)) !== JSON.stringify(details(currentPrice))) return true;
  }
  return false;
}
