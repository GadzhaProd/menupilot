/**
 * Costs of one recipe as the editor shows them. Only calls src/calc; no formula lives here.
 * Results hold BigInt values: derive them while rendering, never store or serialise them.
 */
import {
  batchCostMicro, ingredientLineCostMicro, metrics, prepLineCostMicro, prepUnitCostDisplay, recipeCost,
} from '@/ui/domain/calc';
import type { Metrics, MenuDocument, Recipe, RecipeLine } from '@/ui/domain/types';

type Catalog = Pick<MenuDocument, 'ingredients' | 'recipes'>;

/** Cost of one line, or why it cannot be calculated. `costMicro: null` with no `error` = price unknown. */
export interface LineCost {
  costMicro: bigint | null;
  error?: string;
}

export interface RecipeCosts {
  /** Recipe-based ingredient cost of the whole batch (micro-euros); null = cost unknown. */
  batchCostMicro: bigint | null;
  /** Dish only: per portion, price excl. VAT, contribution, food cost %, margin %. */
  dish: Metrics | null;
  /** Prep only: cost per kg, l or pc as text such as "€1.80/kg"; null = cost unknown. */
  prepUnitCost: string | null;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : 'Calculation failed.');

/** Replace the recipe with the same id, or add it: lets the editor price a draft that is not saved yet. */
export function withRecipe(catalog: Catalog, recipe: Recipe): Catalog {
  const known = catalog.recipes.some((entry) => entry.id === recipe.id);
  return {
    ingredients: catalog.ingredients,
    recipes: known ? catalog.recipes.map((entry) => (entry.id === recipe.id ? recipe : entry)) : [...catalog.recipes, recipe],
  };
}

export function lineCost(line: RecipeLine, catalog: Catalog): LineCost {
  try {
    if (line.ref.kind === 'ingredient') {
      const ingredient = catalog.ingredients.find((entry) => entry.id === line.ref.id);
      if (!ingredient) return { costMicro: null, error: 'Ingredient not found.' };
      return { costMicro: ingredientLineCostMicro(ingredient, line) };
    }
    const prep = catalog.recipes.find((entry) => entry.id === line.ref.id);
    if (prep?.kind !== 'prep') return { costMicro: null, error: 'Prep not found.' };
    return { costMicro: prepLineCostMicro(line, prep, catalog) };
  } catch (error) {
    return { costMicro: null, error: describe(error) };
  }
}

/** Batch cost and the figures built on it. Throws nothing: a cycle or bad reference becomes `error`. */
export function recipeCosts(recipe: Recipe, catalog: Catalog): RecipeCosts | { error: string } {
  try {
    if (recipe.kind === 'dish') {
      const cost = recipeCost(recipe, catalog);
      return {
        batchCostMicro: cost.batchCostMicro,
        dish: metrics({
          recipeCostPerPortionMicro: cost.costPerPortionMicro,
          menuPriceInclVatCents: recipe.menuPriceInclVatCents,
          vatRateBp: recipe.vatRateBp,
          monthlyVolume: recipe.monthlyVolume ?? null,
        }),
        prepUnitCost: null,
      };
    }
    const batch = batchCostMicro(recipe, catalog);
    return {
      batchCostMicro: batch,
      dish: null,
      prepUnitCost: prepUnitCostDisplay(batch, recipe.outputMilli, recipe.outputUnit),
    };
  } catch (error) {
    return { error: describe(error) };
  }
}

export interface PrepRow {
  id: string;
  name: string;
  /** "€1.80/kg", or null when an ingredient price is missing. */
  unitCost: string | null;
  error?: string;
}

/** Cost per kg, l or pc of every prep, at the latest prices. */
export function prepRows(catalog: Catalog): PrepRow[] {
  return catalog.recipes.flatMap((recipe): PrepRow[] => {
    if (recipe.kind !== 'prep') return [];
    const costs = recipeCosts(recipe, catalog);
    if ('error' in costs) return [{ id: recipe.id, name: recipe.name, unitCost: null, error: costs.error }];
    return [{ id: recipe.id, name: recipe.name, unitCost: costs.prepUnitCost }];
  });
}
