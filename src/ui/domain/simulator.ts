/**
 * What the Profit Simulator needs from the core. Only calls src/calc; no formula lives here.
 * Results hold BigInt values: derive them while rendering, never store or serialise them.
 */
import {
  compare, createBaselineSnapshot, isBaselineStale, selectPriceAtDate, simulate,
} from '@/ui/domain/calc';
import type {
  Baseline, BaseUnit, MenuDocument, PriceRecord, ScenarioComparison, SimulateResult,
} from '@/ui/domain/types';

type Catalog = Pick<MenuDocument, 'ingredients' | 'recipes'>;

/** The changes a scenario makes. Plain safe integers, as the store keeps them. */
export interface ScenarioOverrides {
  menuPriceInclVatCents?: number;
  monthlyVolume?: number;
  /** Ingredient id to new pack price (cents, excl. VAT). */
  ingredientPriceCents: Record<string, number>;
  /** Top-level dish line id to new net quantity (thousandths of the base unit). */
  lineQtyMilli: Record<string, number>;
}

export const NO_CHANGES: ScenarioOverrides = Object.freeze({ ingredientPriceCents: {}, lineQtyMilli: {} });

const describe = (error: unknown) => (error instanceof Error ? error.message : 'Calculation failed.');

/** A calculation that may fail (for example a reference that no longer exists). */
export type Run = { ok: true; result: SimulateResult } | { ok: false; error: string };

/** Snapshot of the dish, its preps and their prices at `takenAt`. */
export function takeBaseline(
  data: Catalog,
  dishId: string,
  takenAt: string,
): { ok: true; baseline: Baseline } | { ok: false; error: string } {
  try {
    return { ok: true, baseline: createBaselineSnapshot(data, dishId, takenAt) };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

/** `simulate` that reports an error instead of throwing. The baseline is never changed. */
export function runScenario(baseline: Baseline, overrides: ScenarioOverrides): Run {
  try {
    return { ok: true, result: simulate(baseline, overrides) };
  } catch (error) {
    return { ok: false, error: describe(error) };
  }
}

export type ScenarioDelta = ScenarioComparison['scenarios'][number];

/** Differences against Baseline, in the same order as `runs`; a failed run has none. */
export function compareRuns(baseline: SimulateResult, runs: readonly Run[]): (ScenarioDelta | null)[] {
  const okResults = runs.flatMap((run) => (run.ok ? [run.result] : []));
  const deltas = compare(baseline, okResults).scenarios;
  let next = 0;
  return runs.map((run) => (run.ok ? deltas[next++] ?? null : null));
}

export const isStale = (baseline: Baseline, data: Catalog) => isBaselineStale(baseline, data);

/** One ingredient the scenario may reprice. */
export interface IngredientInfo {
  id: string;
  name: string;
  unit: BaseUnit;
  /** Names of the dish and preps whose lines use it. */
  usedIn: string[];
  /** Price in force at the baseline date; null = no price yet (cannot be changed). */
  price: PriceRecord | null;
  /** The price before that one, when there is one. */
  earlier: PriceRecord | null;
}

export function ingredientInfos(baseline: Baseline): IngredientInfo[] {
  return baseline.ingredients.map((ingredient) => {
    const price = selectPriceAtDate(ingredient.prices, baseline.takenAt);
    const index = price === null ? -1 : ingredient.prices.indexOf(price);
    return {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      usedIn: baseline.recipes
        .filter((recipe) => recipe.lines.some((line) => line.ref.kind === 'ingredient' && line.ref.id === ingredient.id))
        .map((recipe) => recipe.name),
      price,
      earlier: index > 0 ? ingredient.prices[index - 1] ?? null : null,
    };
  });
}

/** One top-level line of the dish. Prep lines are shown but cannot be changed. */
export interface LineInfo {
  id: string;
  name: string;
  refKind: 'ingredient' | 'prep';
  unit: BaseUnit;
  netQtyMilli: number;
}

export function dishLines(baseline: Baseline): LineInfo[] {
  const dish = baseline.recipes.find((recipe) => recipe.id === baseline.recipeId);
  if (!dish) return [];
  return dish.lines.flatMap((line): LineInfo[] => {
    if (line.ref.kind === 'ingredient') {
      const ingredient = baseline.ingredients.find((entry) => entry.id === line.ref.id);
      return ingredient ? [{ id: line.id, name: ingredient.name, refKind: 'ingredient', unit: ingredient.unit, netQtyMilli: line.netQtyMilli }] : [];
    }
    const prep = baseline.recipes.find((entry) => entry.id === line.ref.id);
    return prep?.kind === 'prep'
      ? [{ id: line.id, name: prep.name, refKind: 'prep', unit: prep.outputUnit, netQtyMilli: line.netQtyMilli }]
      : [];
  });
}

/**
 * Carry a scenario's changes over to a fresh baseline. A change that no longer applies
 * (the ingredient or line is gone, or the ingredient has no price) is dropped, and
 * `dropped` says so in words.
 */
export function rebaseOverrides(
  oldBaseline: Baseline,
  newBaseline: Baseline,
  overrides: ScenarioOverrides,
): { overrides: ScenarioOverrides; dropped: string[] } {
  const dropped: string[] = [];
  const ingredientPriceCents: Record<string, number> = {};
  const priceable = new Map(ingredientInfos(newBaseline).map((info) => [info.id, info]));
  for (const [id, cents] of Object.entries(overrides.ingredientPriceCents)) {
    const name = oldBaseline.ingredients.find((entry) => entry.id === id)?.name ?? id;
    const now = priceable.get(id);
    if (now?.price) ingredientPriceCents[id] = cents;
    else dropped.push(`the price change for ${name} (${now ? 'it has no price now' : 'it is no longer used by this dish'})`);
  }
  const lineQtyMilli: Record<string, number> = {};
  const lines = new Map(dishLines(newBaseline).filter((line) => line.refKind === 'ingredient').map((line) => [line.id, line]));
  const oldLines = new Map(dishLines(oldBaseline).map((line) => [line.id, line]));
  for (const [id, milli] of Object.entries(overrides.lineQtyMilli)) {
    if (lines.has(id)) lineQtyMilli[id] = milli;
    else dropped.push(`the quantity change for ${oldLines.get(id)?.name ?? 'a line'} (that line is no longer in the dish)`);
  }
  return {
    overrides: { ...overrides, ingredientPriceCents, lineQtyMilli },
    dropped,
  };
}

export interface BestChoice {
  /** Column keys that share the highest estimated monthly contribution. */
  keys: string[];
  /** Highest value in cents. */
  cents: bigint;
}

/** Which columns have the highest estimated monthly contribution (only those with a figure take part). */
export function highestMonthly(columns: readonly { key: string; monthlyCents: bigint | null }[]): BestChoice | null {
  let best: BestChoice | null = null;
  for (const column of columns) {
    if (column.monthlyCents === null) continue;
    if (best === null || column.monthlyCents > best.cents) best = { keys: [column.key], cents: column.monthlyCents };
    else if (column.monthlyCents === best.cents) best.keys.push(column.key);
  }
  return best;
}
