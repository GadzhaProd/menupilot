/**
 * Typed view of the MenuPilot data format (docs/planning/03_ARCHITECTURE.md, section 5)
 * and of what src/calc returns. The calculation core and the store stay plain
 * JavaScript; these types are the contract the UI relies on.
 *
 * Stored values are safe integers (`number`). Calculation results are `bigint`
 * (micro-euros, cents or tenths of a percent) and must never be stored,
 * serialised or converted to `number`.
 */

export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

/** Stored base units; kg and l are converted when entered. */
export type BaseUnit = 'g' | 'ml' | 'pc';

interface PriceRecordShape {
  seq: number;
  /** Strict ISO timestamp with time zone. */
  recordedAt: string;
  /** Supplier price excl. VAT, in euro cents. */
  packPriceCents: number;
  packSizeMilli: number;
}

interface IngredientShape {
  id: string;
  name: string;
  unit: BaseUnit;
  /** Append-only history; the current price is the latest entry. */
  prices: PriceRecordShape[];
}

interface RefShape {
  kind: 'ingredient' | 'prep';
  id: string;
}

interface LineShape {
  id: string;
  ref: RefShape;
  /** In thousandths of the base unit of the referenced ingredient or prep output. */
  netQtyMilli: number;
  yieldBp: number;
}

interface DishShape {
  id: string;
  name: string;
  kind: 'dish';
  /** Menu price INCLUDING VAT, in euro cents. */
  menuPriceInclVatCents: number;
  vatRateBp: number;
  portions: number;
  /** The owner's estimate, not a forecast. */
  monthlyVolume?: number | null;
  lines: LineShape[];
}

interface PrepShape {
  id: string;
  name: string;
  kind: 'prep';
  outputMilli: number;
  outputUnit: BaseUnit;
  lines: LineShape[];
}

type RecipeShape = DishShape | PrepShape;

/** Baseline snapshot: a mini document with one dish and everything reachable from it. */
interface BaselineShape {
  takenAt: string;
  recipeId: string;
  ingredients: IngredientShape[];
  recipes: RecipeShape[];
}

interface OverridesShape {
  menuPriceInclVatCents?: number | null;
  monthlyVolume?: number | null;
  /** Ingredient id to pack price (cents) */
  ingredientPriceCents?: Record<string, number | null>;
  /** Top-level dish line id to quantity (thousandths) */
  lineQtyMilli?: Record<string, number | null>;
}

interface ScenarioShape {
  id: string;
  recipeId: string;
  name: string;
  createdAt: string;
  baseline: BaselineShape;
  overrides: OverridesShape;
}

interface DocumentShape {
  version: 1;
  settings: { defaultVatRateBp: number };
  ingredients: IngredientShape[];
  recipes: RecipeShape[];
  scenarios: ScenarioShape[];
}

// Documents are deep-frozen by the store, so the UI only ever sees readonly data.
export type PriceRecord = DeepReadonly<PriceRecordShape>;
export type Ingredient = DeepReadonly<IngredientShape>;
export type RecipeRef = DeepReadonly<RefShape>;
export type RecipeLine = DeepReadonly<LineShape>;
export type Dish = DeepReadonly<DishShape>;
export type Prep = DeepReadonly<PrepShape>;
export type Recipe = Dish | Prep;
export type Baseline = DeepReadonly<BaselineShape>;
export type Overrides = DeepReadonly<OverridesShape>;
export type Scenario = DeepReadonly<ScenarioShape>;
export type MenuDocument = DeepReadonly<DocumentShape>;

/** What a command passes to the store: like the stored shape, but `id` may be omitted. */
type WithOptionalId<T> = T extends unknown ? Omit<T, 'id'> & { id?: string } : never;
export type RecipeInput = WithOptionalId<Recipe>;
export type ScenarioInput = WithOptionalId<Scenario>;
export interface PriceInput {
  packPriceCents: number;
  packSizeMilli: number;
}
export interface IngredientInput {
  id?: string;
  name: string;
  unit: BaseUnit;
  price?: PriceInput;
}

/* ---- results of src/calc (BigInt fields: derived, never stored) ---- */

export type MetricsStatus = 'ready' | 'cost-unknown' | 'price-zero';

export interface Metrics {
  status: MetricsStatus;
  priceExclVatMicro: bigint;
  recipeCostPerPortionMicro: bigint | null;
  contributionMicro: bigint | null;
  foodCostTenthsPct: bigint | null;
  contributionMarginTenthsPct: bigint | null;
  monthlyContributionCents: bigint | null;
}

export interface RecipeCost {
  batchCostMicro: bigint | null;
  costPerPortionMicro: bigint | null;
}

export interface MetricsInput {
  recipeCostPerPortionMicro: bigint | null;
  menuPriceInclVatCents: number;
  vatRateBp: number;
  monthlyVolume?: number | null;
}

export interface SimulateResult extends Metrics {
  recipeId: string;
  menuPriceInclVatCents: number;
  vatRateBp: number;
  monthlyVolume: number | null;
  ingredientCostCents: bigint | null;
  netPriceCents: bigint;
  contributionCents: bigint | null;
  foodCostPct: bigint | null;
  marginPct: bigint | null;
}

export interface ScenarioComparison {
  baseline: SimulateResult;
  scenarios: {
    result: SimulateResult;
    contributionDeltaCents: bigint | null;
    monthlyContributionDeltaCents: bigint | null;
    ingredientCostDeltaCents: bigint | null;
    foodCostDeltaTenthsPct: bigint | null;
  }[];
}

/** Error codes thrown by the store (src/store/errors.js). */
export type StoreErrorCode =
  | 'conflict' | 'write-busy' | 'write-unavailable'
  | 'corrupt-json' | 'unsupported-version' | 'invalid' | 'read-failed' | 'write-failed'
  | 'quota' | 'in-use' | 'not-found' | 'not-loaded' | 'bad-options';

/** Derived unit-price display value, never stored in the menu document. */
export interface UnitPrice {
  readonly cents: bigint;
  readonly per: 'kg' | 'l' | 'pc';
}
