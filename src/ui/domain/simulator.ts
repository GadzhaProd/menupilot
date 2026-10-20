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

/** One top-level line of the dish. Prep internals are not included here. */
export interface LineInfo {
  id: string;
  name: string;
  refKind: 'ingredient' | 'prep';
  /** Id of the ingredient or prep the line points to. */
  refId: string;
  unit: BaseUnit;
  netQtyMilli: number;
}

export function dishLines(baseline: Baseline): LineInfo[] {
  const dish = baseline.recipes.find((recipe) => recipe.id === baseline.recipeId);
  if (!dish) return [];
  return dish.lines.flatMap((line): LineInfo[] => {
    if (line.ref.kind === 'ingredient') {
      const ingredient = baseline.ingredients.find((entry) => entry.id === line.ref.id);
      return ingredient ? [{ id: line.id, name: ingredient.name, refKind: 'ingredient', refId: ingredient.id, unit: ingredient.unit, netQtyMilli: line.netQtyMilli }] : [];
    }
    const prep = baseline.recipes.find((entry) => entry.id === line.ref.id);
    return prep?.kind === 'prep'
      ? [{ id: line.id, name: prep.name, refKind: 'prep', refId: prep.id, unit: prep.outputUnit, netQtyMilli: line.netQtyMilli }]
      : [];
  });
}

/** What `rebaseOverrides` dropped, so the form can clear exactly those fields. */
export interface RebaseNote {
  key: 'simulator.rebase.priceMissing' | 'simulator.rebase.priceUnused' | 'simulator.rebase.lineMissing' | 'simulator.rebase.lineReplaced' | 'simulator.rebase.unitChanged';
  params: { name: string; other: string; from: string; to: string };
}
export interface Rebased {
  notes: RebaseNote[];
  overrides: ScenarioOverrides;
  /** Dropped changes in words. */
  dropped: string[];
  droppedPriceIds: string[];
  droppedLineIds: string[];
}

/**
 * Carry a scenario's changes over to a fresh baseline. A price change stays only while the
 * ingredient is still reachable from the dish and has a price. A quantity change stays only
 * while the line with the same id still points to the same ingredient or prep and has the same
 * base unit. Anything else is dropped, and `dropped` says so in words.
 */
export function rebaseOverrides(
  oldBaseline: Baseline,
  newBaseline: Baseline,
  overrides: ScenarioOverrides,
): Rebased {
  const dropped: string[] = [];
  const notes: RebaseNote[] = [];
  const note = (key: RebaseNote['key'], name: string, other = '', from = '', to = '') => notes.push({ key, params: { name, other, from, to } });
  const droppedPriceIds: string[] = [];
  const droppedLineIds: string[] = [];
  const ingredientPriceCents: Record<string, number> = {};
  const priceable = new Map(ingredientInfos(newBaseline).map((info) => [info.id, info]));
  for (const [id, cents] of Object.entries(overrides.ingredientPriceCents)) {
    const name = oldBaseline.ingredients.find((entry) => entry.id === id)?.name ?? id;
    const now = priceable.get(id);
    if (now?.price) {
      ingredientPriceCents[id] = cents;
    } else {
      droppedPriceIds.push(id);
      note(now ? 'simulator.rebase.priceMissing' : 'simulator.rebase.priceUnused', name);
      dropped.push(`the price change for ${name} (${now ? 'it has no price now' : 'it is no longer used by this dish'})`);
    }
  }
  const lineQtyMilli: Record<string, number> = {};
  const newLines = new Map(dishLines(newBaseline).map((line) => [line.id, line]));
  const oldLines = new Map(dishLines(oldBaseline).map((line) => [line.id, line]));
  for (const [id, milli] of Object.entries(overrides.lineQtyMilli)) {
    const before = oldLines.get(id);
    const now = newLines.get(id);
    const name = before?.name ?? 'a line';
    if (!now) {
      droppedLineIds.push(id);
      note('simulator.rebase.lineMissing', name);
      dropped.push(`the quantity change for ${name} (that line is no longer in the dish)`);
    } else if (before && (before.refKind !== now.refKind || before.refId !== now.refId)) {
      droppedLineIds.push(id);
      note('simulator.rebase.lineReplaced', name, now.name);
      dropped.push(`the quantity change for ${name} (that line now holds ${now.name})`);
    } else if (before && before.unit !== now.unit) {
      droppedLineIds.push(id);
      note('simulator.rebase.unitChanged', name, '', before.unit, now.unit);
      dropped.push(`the quantity change for ${name} (its unit changed from ${before.unit} to ${now.unit})`);
    } else {
      lineQtyMilli[id] = milli;
    }
  }
  return { overrides: { ...overrides, ingredientPriceCents, lineQtyMilli }, dropped, notes, droppedPriceIds, droppedLineIds };
}

export interface BestChoice {
  /** Column keys that share the highest estimated monthly contribution. */
  keys: string[];
  /** Highest value in cents. */
  cents: bigint;
}

/**
 * Which columns have the highest estimated monthly contribution. Only columns with a figure
 * take part, and there must be at least two of them: one result alone is nothing to compare.
 */
export interface MonthlyColumn { key: string; monthlyCents: bigint | null; monthlyVolume: number | null }
const comparableMonthly = (columns: readonly MonthlyColumn[]) =>
  columns.filter((column): column is MonthlyColumn & { monthlyCents: bigint; monthlyVolume: number } =>
    column.monthlyCents !== null && column.monthlyVolume !== null);

export function monthlyVolumesDiffer(columns: readonly MonthlyColumn[]): boolean {
  return new Set(comparableMonthly(columns).map(column => column.monthlyVolume)).size > 1;
}

export function highestMonthly(columns: readonly MonthlyColumn[]): BestChoice | null {
  const comparable = comparableMonthly(columns);
  if (comparable.length < 2 || monthlyVolumesDiffer(comparable)) return null;
  let best: BestChoice | null = null;
  for (const column of comparable) {
    if (best === null || column.monthlyCents > best.cents) best = { keys: [column.key], cents: column.monthlyCents };
    else if (column.monthlyCents === best.cents) best.keys.push(column.key);
  }
  return best;
}
