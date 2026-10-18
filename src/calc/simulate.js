import { metrics, recipeCost, selectPriceAtDate } from './costing.js';
import { assertStrictIsoTimestamp, safeInteger } from './internal.js';
import { roundDiv } from './money.js';
import { MICRO_EUROS_PER_CENT } from './constants.js';

/** Copy a recipe and its lines without retaining mutable line references. */
function copyRecipe(recipe) {
  return {
    ...recipe,
    lines: recipe.lines.map((line) => ({ ...line, ref: { ...line.ref } })),
  };
}

/** Copy an ingredient and its complete append-only price history. */
function copyIngredient(ingredient) {
  return { ...ingredient, prices: (ingredient.prices ?? []).map((price) => ({ ...price })) };
}

/** Compare strings by code-unit order for stable, locale-independent sorting. */
function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Collect and copy exactly the dish's reachable recipe graph and ingredients.
 * @param {{ingredients:object[], recipes:object[]}} data Full document.
 * @param {string} recipeId Dish id.
 * @param {string} takenAt Strict ISO timestamp with timezone.
 * @returns {{takenAt:string, recipeId:string, ingredients:object[], recipes:object[]}}
 */
function reachableSnapshot(data, recipeId, takenAt) {
  if (!data || !Array.isArray(data.ingredients) || !Array.isArray(data.recipes)) {
    throw new TypeError('Data must contain ingredients and recipes arrays.');
  }
  assertStrictIsoTimestamp(takenAt, 'takenAt');
  const root = data.recipes.find((recipe) => recipe.id === recipeId);
  if (!root) throw new TypeError(`Unknown recipe: ${recipeId}.`);
  if (root.kind !== 'dish') throw new TypeError('Baseline recipe must be a dish.');

  const ingredients = new Map();
  const recipes = new Map();
  const activePath = [];
  function visit(recipe) {
    const cycleStart = activePath.indexOf(recipe.id);
    if (cycleStart !== -1) {
      throw new Error(`Recipe cycle detected: ${[...activePath.slice(cycleStart), recipe.id].join(' -> ')}.`);
    }
    if (recipes.has(recipe.id)) return;
    activePath.push(recipe.id);
    for (const line of recipe.lines) {
      if (line.ref?.kind === 'ingredient') {
        const ingredient = data.ingredients.find((item) => item.id === line.ref.id);
        if (!ingredient) throw new TypeError(`Unknown ingredient reference: ${line.ref.id}.`);
        ingredients.set(ingredient.id, ingredient);
      } else if (line.ref?.kind === 'prep') {
        const prep = data.recipes.find((item) => item.id === line.ref.id && item.kind === 'prep');
        if (!prep) throw new TypeError(`Unknown prep reference: ${line.ref.id}.`);
        visit(prep);
      } else {
        throw new TypeError(`Unsupported recipe line reference kind: ${line.ref?.kind}.`);
      }
    }
    activePath.pop();
    recipes.set(recipe.id, recipe);
  }
  visit(root);

  return {
    takenAt,
    recipeId,
    ingredients: [...ingredients.values()].map(copyIngredient),
    recipes: data.recipes.filter((recipe) => recipes.has(recipe.id)).map(copyRecipe),
  };
}

/** Build a mini-document containing a dish and all reachable preps and ingredients.
 * @param {{ingredients:object[], recipes:object[]}} data Full document.
 * @param {string} recipeId Dish id.
 * @param {string} takenAt Strict ISO timestamp with timezone.
 * @returns {{takenAt:string, recipeId:string, ingredients:object[], recipes:object[]}}
 */
export function createBaselineSnapshot(data, recipeId, takenAt) {
  if (typeof recipeId !== 'string') throw new TypeError('recipeId must be a string.');
  return reachableSnapshot(data, recipeId, takenAt);
}

/** Validate the override container and its two keyed override maps. */
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

/** Apply quantity changes to dish-level lines only.
 * @param {object} baseline Baseline mini-document.
 * @param {object} dish Baseline dish.
 * @param {Record<string,number|null|undefined>} overrides Quantity overrides keyed by line id.
 * @returns {object[]} Copied lines with scenario quantities.
 */
function applyLineOverrides(baseline, dish, overrides) {
  const lines = dish.lines.map((line) => ({ ...line, ref: { ...line.ref } }));
  const lineById = new Map(lines.map((line) => [line.id, line]));
  for (const [lineId, quantity] of Object.entries(overrides ?? {})) {
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
  return lines;
}

/** Apply pack-price changes while retaining the pack size selected at baseline date.
 * @param {object} baseline Baseline mini-document.
 * @param {Record<string,number|null|undefined>} overrides Price overrides keyed by ingredient id.
 * @returns {object[]} Ingredient inputs for costing.
 */
function applyPriceOverrides(baseline, overrides) {
  const priceOverrides = overrides ?? {};
  for (const id of Object.keys(priceOverrides)) {
    if (!baseline.ingredients.some((ingredient) => ingredient.id === id)) {
      throw new TypeError(`Unknown ingredient id: ${id}.`);
    }
  }
  return baseline.ingredients.map((ingredient) => {
    const packPriceCents = priceOverrides[ingredient.id];
    if (packPriceCents === undefined || packPriceCents === null) return ingredient;
    safeInteger(packPriceCents, `ingredientPriceCents.${ingredient.id}`, 0);
    const selectedPrice = selectPriceAtDate(ingredient.prices ?? [], baseline.takenAt);
    if (!selectedPrice) {
      throw new TypeError(`Cannot override price for ${ingredient.id}: no price pack size exists at baseline date.`);
    }
    return {
      ...ingredient,
      prices: ingredient.prices.map((price) => price === selectedPrice
        ? { ...price, packPriceCents }
        : price),
    };
  });
}

/** Use an override when supplied, validating its stored integer range. */
function optionalIntegerOverride(overrides, key, original, minimum) {
  const value = overrides[key];
  if (value === null || value === undefined) return original;
  safeInteger(value, key, minimum);
  return value;
}

/** Return the displayed amount in cents, preserving unknown as null. */
function displayCents(microEuros) {
  return microEuros === null ? null : roundDiv(microEuros, MICRO_EUROS_PER_CENT);
}

/** Calculate scenario metrics from a baseline snapshot without changing it.
 * @param {{takenAt:string, recipeId:string, ingredients:object[], recipes:object[]}} baseline
 * @param {{menuPriceInclVatCents?:number|null, monthlyVolume?:number|null, ingredientPriceCents?:Record<string,number|null>, lineQtyMilli?:Record<string,number|null>}} overrides
 * @returns {SimulateResult} Raw calculation metrics plus display-ready cents and percentage tenths.
 */
export function simulate(baseline, overrides = {}) {
  validateOverrides(overrides);
  const dish = baseline?.recipes?.find((recipe) => recipe.id === baseline.recipeId);
  if (!dish || dish.kind !== 'dish') throw new TypeError('Baseline must contain its dish recipe.');
  const lines = applyLineOverrides(baseline, dish, overrides.lineQtyMilli ?? {});
  const ingredients = applyPriceOverrides(baseline, overrides.ingredientPriceCents ?? {});
  const menuPriceInclVatCents = optionalIntegerOverride(
    overrides, 'menuPriceInclVatCents', dish.menuPriceInclVatCents, 0,
  );
  const monthlyVolume = optionalIntegerOverride(overrides, 'monthlyVolume', dish.monthlyVolume, 0);
  const scenarioDish = { ...dish, lines, menuPriceInclVatCents };
  const data = {
    ingredients,
    recipes: baseline.recipes.map((recipe) => recipe.id === dish.id ? scenarioDish : recipe),
  };
  const cost = recipeCost(scenarioDish, data, { asOf: baseline.takenAt });
  const calculated = metrics({
    recipeCostPerPortionMicro: cost.costPerPortionMicro,
    menuPriceInclVatCents,
    vatRateBp: dish.vatRateBp,
    monthlyVolume,
  });
  return {
    recipeId: baseline.recipeId,
    menuPriceInclVatCents,
    vatRateBp: dish.vatRateBp,
    monthlyVolume: monthlyVolume ?? null,
    ...calculated,
    ingredientCostCents: displayCents(cost.costPerPortionMicro),
    netPriceCents: displayCents(calculated.priceExclVatMicro),
    contributionCents: displayCents(calculated.contributionMicro),
    foodCostPct: calculated.foodCostTenthsPct,
    marginPct: calculated.contributionMarginTenthsPct,
  };
}

/** A display-ready simulation result. Percentage fields are integer tenths of a percent. */
/** @typedef {object} SimulateResult
 * @property {string} recipeId
 * @property {number} menuPriceInclVatCents
 * @property {number} vatRateBp
 * @property {number|null} monthlyVolume
 * @property {'ready'|'cost-unknown'|'price-zero'} status
 * @property {bigint} priceExclVatMicro
 * @property {bigint|null} recipeCostPerPortionMicro
 * @property {bigint|null} contributionMicro
 * @property {bigint|null} foodCostTenthsPct
 * @property {bigint|null} contributionMarginTenthsPct
 * @property {bigint|null} monthlyContributionCents
 * @property {bigint|null} ingredientCostCents
 * @property {bigint} netPriceCents
 * @property {bigint|null} contributionCents
 * @property {bigint|null} foodCostPct
 * @property {bigint|null} marginPct
 */

/** Compare scenarios by subtracting their already displayed values from baseline.
 * @param {SimulateResult} baselineResult Result from simulate.
 * @param {SimulateResult[]} scenarioResults Results from simulate.
 * @returns {{baseline:SimulateResult, scenarios:{result:SimulateResult, contributionDeltaCents:bigint|null, monthlyContributionDeltaCents:bigint|null, ingredientCostDeltaCents:bigint|null, foodCostDeltaTenthsPct:bigint|null}[]}}
 */
export function compare(baselineResult, scenarioResults) {
  if (!baselineResult || !Array.isArray(scenarioResults)) throw new TypeError('compare expects a baseline result and scenario result array.');
  const delta = (baselineValue, scenarioValue) => baselineValue === null || scenarioValue === null
    ? null
    : scenarioValue - baselineValue;
  return {
    baseline: baselineResult,
    scenarios: scenarioResults.map((result) => ({
      result,
      contributionDeltaCents: delta(baselineResult.contributionCents, result.contributionCents),
      monthlyContributionDeltaCents: delta(baselineResult.monthlyContributionCents, result.monthlyContributionCents),
      ingredientCostDeltaCents: delta(baselineResult.ingredientCostCents, result.ingredientCostCents),
      foodCostDeltaTenthsPct: delta(baselineResult.foodCostPct, result.foodCostPct),
    })),
  };
}

/** Convert an object to a key-sorted representation for semantic comparison. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

/** Normalize a recipe for stale checks, ignoring its display name and line order. */
function recipeMeaning(recipe) {
  const { name, lines, ...fields } = recipe;
  return { ...fields, lines: [...lines].sort((left, right) => compareText(left.id, right.id)) };
}

/** Normalize historical prices at or before baseline date, ignoring storage order. */
function historicalPriceMeaning(ingredient, takenAt) {
  return (ingredient.prices ?? [])
    .filter((price) => selectPriceAtDate([price], takenAt) !== null)
    .map(({ seq, recordedAt, packPriceCents, packSizeMilli }) => ({ seq, recordedAt, packPriceCents, packSizeMilli }))
    .sort((left, right) => compareText(left.recordedAt, right.recordedAt) || left.seq - right.seq);
}

/** Check whether current reachable recipes or their prices differ from baseline.
 * Missing or invalid reachable entities are treated as stale.
 * @param {object} baseline Snapshot returned by createBaselineSnapshot.
 * @param {{ingredients:object[], recipes:object[]}} currentData Current document.
 * @returns {boolean}
 */
export function isBaselineStale(baseline, currentData) {
  try {
    const current = reachableSnapshot(currentData, baseline.recipeId, baseline.takenAt);
    const sortById = (left, right) => compareText(left.id, right.id);
    const baselineRecipes = baseline.recipes.map(recipeMeaning).sort(sortById);
    const currentRecipes = current.recipes.map(recipeMeaning).sort(sortById);
    if (JSON.stringify(canonical(baselineRecipes)) !== JSON.stringify(canonical(currentRecipes))) return true;

    const baselineIngredients = new Map(baseline.ingredients.map((ingredient) => [ingredient.id, ingredient]));
    if (baselineIngredients.size !== current.ingredients.length) return true;
    for (const ingredient of current.ingredients) {
      const old = baselineIngredients.get(ingredient.id);
      if (!old || old.unit !== ingredient.unit) return true;
      if (JSON.stringify(historicalPriceMeaning(old, baseline.takenAt)) !== JSON.stringify(historicalPriceMeaning(ingredient, baseline.takenAt))) return true;
      const oldPrice = selectPriceAtDate(old.prices ?? []);
      const currentPrice = selectPriceAtDate(ingredient.prices ?? []);
      const details = (price) => price && ({ packPriceCents: price.packPriceCents, packSizeMilli: price.packSizeMilli });
      if (JSON.stringify(details(oldPrice)) !== JSON.stringify(details(currentPrice))) return true;
    }
  } catch {
    return true;
  }
  return false;
}
