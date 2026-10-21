/**
 * Type declarations for the plain-JavaScript core (src/calc, src/store).
 * The core is imported through the `@` alias, so these ambient modules win over the
 * untyped files and the UI gets precise types without any change to the core.
 * test/ui/domain.contract.test.ts checks that every declared export exists at runtime.
 */

declare module '@/calc/money.js' {
  export function normalizeLocale(locale?: string): 'en' | 'nl';
  export function formatEURFromCentsLocale(cents: number | bigint, locale?: string): string;
  export function formatEURFromMicroLocale(microEuros: bigint, locale?: string): string;
  export function formatPercentTenthsLocale(tenths: bigint | null, locale?: string): string;
  export function formatPointsLocale(tenths: bigint | null, locale?: string): string;
  export function formatDateLocale(iso: string, locale?: string): string;
  export function roundDiv(numerator: bigint, denominator: bigint): bigint;
  /** Throws TypeError/RangeError with a user-readable message. */
  export function parseMoneyToCents(input: string): number;
  export function formatEURFromCents(cents: number | bigint): string;
  export function formatEURFromMicro(microEuros: bigint): string;
}

declare module '@/calc/impact.js' {
  export function costChangeCents(
    currentMicro: bigint | null,
    comparisonMicro: bigint | null,
  ): bigint | null;
  export function foodCostChangeTenths(
    currentTenths: bigint | null,
    comparisonTenths: bigint | null,
  ): bigint | null;
  export function monthlyImpactCents(
    currentContribution: bigint | null,
    comparisonContribution: bigint | null,
  ): bigint | null;
  export function menuMonthlyImpactCents(
    knownImpacts: readonly (bigint | null)[],
  ): bigint;
  export function averageFoodCostTenths(values: readonly bigint[]): bigint | null;
}

declare module '@/calc/units.js' {
  type BaseUnit = import('@/ui/domain/types').BaseUnit;
  export function normalizeUnit(enteredUnit: string): BaseUnit;
  export function areUnitsCompatible(leftUnit: string, rightUnit: string): boolean;
  export function assertCompatibleUnits(leftUnit: string, rightUnit: string): BaseUnit;
  export function unitPriceSuffix(baseUnit: string): '/kg' | '/l' | '/pc';
  export function parseQuantityToMilli(
    quantityText: string,
    enteredUnit: string,
  ): { unit: BaseUnit; quantityMilli: number };
}

declare module '@/calc/costing.js' {
  import type * as T from '@/ui/domain/types';
  type Catalog = {
    readonly ingredients: readonly T.Ingredient[];
    readonly recipes: readonly T.Recipe[];
  };
  export function selectPriceAtDate(
    prices: readonly T.PriceRecord[],
    asOf?: string,
  ): T.PriceRecord | null;
  export function ingredientLineCostMicro(
    ingredient: T.Ingredient,
    line: Pick<T.RecipeLine, 'netQtyMilli' | 'yieldBp'>,
    options?: { asOf?: string },
  ): bigint | null;
  export function netPriceMicro(menuPriceInclVatCents: number, vatRateBp: number): bigint;
  export function monthlyContributionCents(contributionMicro: bigint, monthlyVolume: number): bigint;
  export function metrics(input: T.MetricsInput): T.Metrics;
  export function recipeCost(recipe: T.Dish, data: Catalog, options?: { asOf?: string }): T.RecipeCost;
  export function batchCostMicro(prep: T.Prep, data: Catalog, options?: { asOf?: string }): bigint | null;
  export function prepLineCostMicro(
    line: T.RecipeLine,
    prep: T.Prep,
    data: Catalog,
    options?: { asOf?: string },
  ): bigint | null;
  export function packUnitPriceCents(packPriceCents: number, packSizeMilli: number, unit: string): T.UnitPrice;
  export function prepUnitCostCents(knownBatchCostMicro: bigint | null, outputMilli: number, outputUnit: string): T.UnitPrice | null;
  export function prepUnitCostDisplay(
    knownBatchCostMicro: bigint | null,
    outputMilli: number,
    outputUnit: string,
  ): string | null;
  export function packUnitPriceDisplay(
    packPriceCents: number,
    packSizeMilli: number,
    unit: string,
  ): string;
}

declare module '@/calc/simulate.js' {
  import type * as T from '@/ui/domain/types';
  export function createBaselineSnapshot(
    data: Pick<T.MenuDocument, 'ingredients' | 'recipes'>,
    recipeId: string,
    takenAt: string,
  ): T.Baseline;
  export function simulate(baseline: T.Baseline, overrides?: T.Overrides): T.SimulateResult;
  export function compare(
    baselineResult: T.SimulateResult,
    scenarioResults: readonly T.SimulateResult[],
  ): T.ScenarioComparison;
  export function isBaselineStale(
    baseline: T.Baseline,
    currentData: Pick<T.MenuDocument, 'ingredients' | 'recipes'>,
  ): boolean;
}

declare module '@/store/store.js' {
  import type * as T from '@/ui/domain/types';

  export const STORAGE_KEY: string;

  export class StoreError extends Error {
    readonly code: T.StoreErrorCode;
    /** Every validation message when code is "invalid". */
    readonly details: readonly string[];
    constructor(code: T.StoreErrorCode, message: string, details?: readonly string[]);
  }

  export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  }

  /** Every command returns the new, deep-frozen document. */
  export interface Store {
    load(options?: { beforeReplace?: (document: T.MenuDocument) => void }): T.MenuDocument;
    getRevision(): string | null | undefined;
    getDocument(): T.MenuDocument;
    readRaw(): string | null;
    save(doc: T.MenuDocument): T.MenuDocument;
    addIngredient(input: T.IngredientInput): { id: string; document: T.MenuDocument };
    updateIngredient(id: string, changes: { name?: string; unit?: T.BaseUnit }): T.MenuDocument;
    addPrice(ingredientId: string, price: T.PriceInput): T.MenuDocument;
    deleteIngredient(id: string): T.MenuDocument;
    saveRecipe(recipe: T.RecipeInput): { id: string; document: T.MenuDocument };
    deleteRecipe(id: string, options?: { deleteScenarios?: boolean }): T.MenuDocument;
    saveScenario(scenario: T.ScenarioInput): { id: string; document: T.MenuDocument };
    deleteScenario(id: string): T.MenuDocument;
    updateSettings(settings: { defaultVatRateBp: number }): T.MenuDocument;
    exportJSON(): string;
    importJSON(text: string): T.MenuDocument;
    resetToDemo(demo?: unknown): T.MenuDocument;
    /** Replace everything with an empty document. */
    resetToEmpty(): T.MenuDocument;
  }

  export function createStore(
    storage: StorageLike,
    options: {
      /** The parsed data/demo.json. */
      demo: unknown;
      now?: () => Date | number | string;
      createId?: (prefix: string) => string;
    },
  ): Store;
}

declare module '@/store/schema.js' {
  export const FORMAT_VERSION: 1;
  export function validateDocument(
    doc: unknown,
    options?: { now?: Date | number | string },
  ): { valid: boolean; errors: string[] };
}
