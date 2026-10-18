import { fail, isObject } from './check.js';

/** Maximum number of nested preps below a dish (a prep inside a prep counts as another level). */
export const MAX_PREP_DEPTH = 5;

const label = (recipe) => recipe.name || recipe.id;

function validRefs(recipe) {
  const lines = Array.isArray(recipe?.lines) ? recipe.lines : [];
  return lines.map((line) => line?.ref).filter((ref) => isObject(ref) && typeof ref.id === 'string');
}

function checkReferences(catalog, path, errors, ingredientIds, recipeById) {
  catalog.recipes.forEach((recipe, recipeIndex) => {
    const lines = Array.isArray(recipe?.lines) ? recipe.lines : [];
    lines.forEach((line, lineIndex) => {
      const ref = line?.ref;
      if (!isObject(ref) || typeof ref.id !== 'string') {
        return;
      }
      const where = `${path ? `${path}.` : ''}recipes[${recipeIndex}].lines[${lineIndex}].ref.id`;
      const target = recipeById.get(ref.id);
      if (ref.kind === 'ingredient' && !ingredientIds.has(ref.id)) {
        const hint = target ? ' (that id belongs to a recipe)' : '';
        fail(errors, where, `unknown ingredient '${ref.id}'${hint}`);
      } else if (ref.kind === 'prep' && target?.kind === 'dish') {
        fail(errors, where, `'${ref.id}' is a dish and cannot be used as a prep`);
      } else if (ref.kind === 'prep' && !target) {
        const hint = ingredientIds.has(ref.id) ? ' (that id belongs to an ingredient)' : '';
        fail(errors, where, `unknown prep '${ref.id}'${hint}`);
      }
    });
  });
}

function prepChildren(recipe, recipeById) {
  return validRefs(recipe)
    .filter((ref) => ref.kind === 'prep')
    .map((ref) => recipeById.get(ref.id))
    .filter((child) => child?.kind === 'prep');
}

/** Depth-first search over prep references; reports each cycle once. */
function findCycles(catalog, path, errors, recipeById) {
  const state = new Map();
  const stack = [];
  let found = false;
  const visit = (recipe) => {
    state.set(recipe.id, 'visiting');
    stack.push(recipe);
    for (const child of prepChildren(recipe, recipeById)) {
      if (state.get(child.id) === 'visiting') {
        const cycle = [...stack.slice(stack.indexOf(child)), child].map(label).join(' -> ');
        const index = catalog.recipes.findIndex((entry) => entry?.id === child.id);
        fail(errors, `${path ? `${path}.` : ''}recipes[${index}]`, `prep cycle ${cycle}`);
        found = true;
      } else if (!state.has(child.id)) {
        visit(child);
      }
    }
    stack.pop();
    state.set(recipe.id, 'done');
  };
  for (const recipe of recipeById.values()) {
    if (!state.has(recipe.id)) {
      visit(recipe);
    }
  }
  return found;
}

function checkDepth(catalog, path, errors, recipeById) {
  const nesting = new Map();
  const depthOf = (recipe) => {
    if (!nesting.has(recipe.id)) {
      const below = Math.max(0, ...prepChildren(recipe, recipeById).map(depthOf));
      nesting.set(recipe.id, below + (recipe.kind === 'prep' ? 1 : 0));
    }
    return nesting.get(recipe.id);
  };
  catalog.recipes.forEach((recipe, index) => {
    if (isObject(recipe) && recipeById.get(recipe.id) === recipe && depthOf(recipe) > MAX_PREP_DEPTH) {
      fail(errors, `${path ? `${path}.` : ''}recipes[${index}]`,
        `prep nesting depth is ${depthOf(recipe)}; the maximum is ${MAX_PREP_DEPTH}`);
    }
  });
}

/**
 * Check that every line points to an existing ingredient or prep of the right kind,
 * and that preps form no cycle and nest at most MAX_PREP_DEPTH levels.
 * Expects `catalog.ingredients` and `catalog.recipes` to be arrays.
 */
export function checkRecipeGraph(catalog, path, errors) {
  const ingredientIds = new Set(catalog.ingredients.filter(isObject).map((entry) => entry.id));
  const recipeById = new Map();
  for (const recipe of catalog.recipes.filter(isObject)) {
    if (!recipeById.has(recipe.id)) {
      recipeById.set(recipe.id, recipe);
    }
  }
  checkReferences(catalog, path, errors, ingredientIds, recipeById);
  if (!findCycles(catalog, path, errors, recipeById)) {
    checkDepth(catalog, path, errors, recipeById);
  }
}
