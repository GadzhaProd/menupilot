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

const MAX_CYCLE_NAMES_SHOWN = 8;

function describeCycle(recipes) {
  const names = recipes.map(label);
  const shown = names.length > MAX_CYCLE_NAMES_SHOWN
    ? [...names.slice(0, MAX_CYCLE_NAMES_SHOWN), `... (${names.length - 1} preps in the cycle)`, names.at(-1)]
    : names;
  return shown.join(' -> ');
}

/**
 * Iterative depth-first search over prep references (no recursion, so a huge input
 * cannot overflow the stack). Reports each cycle once and returns the preps/dishes
 * in post-order (children before parents) plus whether a cycle was found.
 */
function walkPrepGraph(catalog, path, errors, recipeById) {
  const state = new Map();
  const postOrder = [];
  let cycleFound = false;
  const enter = (recipe) => {
    state.set(recipe.id, 'visiting');
    return { recipe, children: prepChildren(recipe, recipeById), next: 0 };
  };
  for (const root of recipeById.values()) {
    if (state.has(root.id)) {
      continue;
    }
    const stack = [enter(root)];
    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (frame.next === frame.children.length) {
        state.set(frame.recipe.id, 'done');
        postOrder.push(frame.recipe);
        stack.pop();
        continue;
      }
      const child = frame.children[frame.next];
      frame.next += 1;
      if (state.get(child.id) === 'visiting') {
        const members = [...stack.slice(stack.findIndex((entry) => entry.recipe === child)).map((entry) => entry.recipe), child];
        const index = catalog.recipes.findIndex((entry) => entry?.id === child.id);
        fail(errors, `${path ? `${path}.` : ''}recipes[${index}]`, `prep cycle ${describeCycle(members)}`);
        cycleFound = true;
      } else if (!state.has(child.id)) {
        stack.push(enter(child));
      }
    }
  }
  return { postOrder, cycleFound };
}

function checkDepth(catalog, path, errors, recipeById, postOrder) {
  const nesting = new Map();
  for (const recipe of postOrder) {
    const below = Math.max(0, ...prepChildren(recipe, recipeById).map((child) => nesting.get(child.id)));
    nesting.set(recipe.id, below + (recipe.kind === 'prep' ? 1 : 0));
  }
  catalog.recipes.forEach((recipe, index) => {
    if (isObject(recipe) && recipeById.get(recipe.id) === recipe && nesting.get(recipe.id) > MAX_PREP_DEPTH) {
      fail(errors, `${path ? `${path}.` : ''}recipes[${index}]`,
        `prep nesting depth is ${nesting.get(recipe.id)}; the maximum is ${MAX_PREP_DEPTH}`);
    }
  });
}

/**
 * Ids of the recipes (the dish itself plus every prep below it) and ingredients that
 * `rootId` uses, directly or through preps. Iterative; safe on cyclic input.
 * @returns {{ recipeIds: Set<string>, ingredientIds: Set<string> }}
 */
export function reachableFrom(recipeById, rootId) {
  const recipeIds = new Set([rootId]);
  const ingredientIds = new Set();
  const pending = [rootId];
  while (pending.length > 0) {
    for (const ref of validRefs(recipeById.get(pending.pop()))) {
      if (ref.kind === 'ingredient') {
        ingredientIds.add(ref.id);
      } else if (ref.kind === 'prep' && !recipeIds.has(ref.id) && recipeById.has(ref.id)) {
        recipeIds.add(ref.id);
        pending.push(ref.id);
      }
    }
  }
  return { recipeIds, ingredientIds };
}

export function indexRecipes(recipes) {
  const recipeById = new Map();
  for (const recipe of recipes.filter(isObject)) {
    if (!recipeById.has(recipe.id)) {
      recipeById.set(recipe.id, recipe);
    }
  }
  return recipeById;
}

/**
 * Check that every line points to an existing ingredient or prep of the right kind,
 * and that preps form no cycle and nest at most MAX_PREP_DEPTH levels.
 * Expects `catalog.ingredients` and `catalog.recipes` to be arrays.
 */
export function checkRecipeGraph(catalog, path, errors) {
  const ingredientIds = new Set(catalog.ingredients.filter(isObject).map((entry) => entry.id));
  const recipeById = indexRecipes(catalog.recipes);
  checkReferences(catalog, path, errors, ingredientIds, recipeById);
  const { postOrder, cycleFound } = walkPrepGraph(catalog, path, errors, recipeById);
  if (!cycleFound) {
    checkDepth(catalog, path, errors, recipeById, postOrder);
  }
}
