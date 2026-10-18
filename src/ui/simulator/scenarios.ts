/**
 * The scenarios on screen: drafts the owner is editing. Pure state with no store calls
 * (the store is called by event handlers, outside this reducer). A draft keeps its typed text,
 * so a failed save never loses input, and `applied` keeps the last changes that were valid,
 * so a half-typed number never blanks the results.
 */
import type { Baseline, Scenario } from '@/ui/domain/types';
import type { Rebased, ScenarioOverrides } from '@/ui/domain/simulator';
import {
  emptyFields, fieldsFromOverrides, parseFields, priceKey, qtyKey, sanitizeOverrides, signature,
  type FieldErrors, type FieldsDraft,
} from './scenarioForm';

export const MAX_SCENARIOS = 3;
const SLOT_LETTERS = ['A', 'B', 'C'] as const;

export interface ScenarioDraft {
  /** React key; stays the same when the scenario gets its saved id. */
  key: string;
  /** Store id once saved. */
  id: string | null;
  createdAt: string | null;
  name: string;
  /** The data this scenario is calculated on; refreshed by "Update baseline". */
  baseline: Baseline;
  fields: FieldsDraft;
  /** Last valid changes: what the results are calculated from. */
  applied: ScenarioOverrides;
  errors: FieldErrors;
  /** Changes dropped by "Update baseline", in words. */
  notes: string[];
  /** Signature of what is saved; null while the scenario was never saved. */
  savedSignature: string | null;
  /** The baseline was refreshed in this draft and the refresh is not saved yet. */
  baselineUpdated: boolean;
}

/** True when something would be lost: never saved, or different from what is saved. */
export const isUnsaved = (draft: ScenarioDraft) =>
  draft.baselineUpdated || signature(draft.name, draft.applied) !== draft.savedSignature;

export const slotLetter = (index: number) => SLOT_LETTERS[index] ?? String(index + 1);

/** "Scenario B" for the second card: the letter of its position, or the first free one if that name is taken. */
export function defaultName(drafts: readonly ScenarioDraft[]): string {
  const taken = (letter: string) => drafts.some((draft) => draft.name === `Scenario ${letter}`);
  const own = slotLetter(drafts.length);
  const letter = taken(own) ? SLOT_LETTERS.find((candidate) => !taken(candidate)) : own;
  return `Scenario ${letter ?? own}`;
}

/** Saved scenarios of a dish, oldest first. */
export function draftsFromSaved(saved: readonly Scenario[]): ScenarioDraft[] {
  return [...saved]
    .sort((left, right) => (left.createdAt < right.createdAt ? -1 : left.createdAt > right.createdAt ? 1 : 0))
    .map((scenario) => {
      const overrides = sanitizeOverrides(scenario.overrides);
      return {
        key: scenario.id,
        id: scenario.id,
        createdAt: scenario.createdAt,
        name: scenario.name,
        baseline: scenario.baseline,
        fields: fieldsFromOverrides(overrides, scenario.baseline),
        applied: overrides,
        errors: {},
        notes: [],
        savedSignature: signature(scenario.name, overrides),
        baselineUpdated: false,
      };
    });
}

export function newDraft(key: string, name: string, baseline: Baseline, fields: FieldsDraft): ScenarioDraft {
  return {
    key, id: null, createdAt: null, name, baseline, fields, applied: parseFields(fields, baseline).overrides,
    errors: {}, notes: [], savedSignature: null, baselineUpdated: false,
  };
}

/** Keep the last valid value of every field that cannot be read right now. */
function keepPrevious(previous: ScenarioOverrides, parsed: ScenarioOverrides, errors: FieldErrors): ScenarioOverrides {
  const next: ScenarioOverrides = {
    ...parsed,
    ingredientPriceCents: { ...parsed.ingredientPriceCents },
    lineQtyMilli: { ...parsed.lineQtyMilli },
  };
  if (errors.menuPrice !== undefined && previous.menuPriceInclVatCents !== undefined) {
    next.menuPriceInclVatCents = previous.menuPriceInclVatCents;
  }
  if (errors.volume !== undefined && previous.monthlyVolume !== undefined) next.monthlyVolume = previous.monthlyVolume;
  for (const [id, cents] of Object.entries(previous.ingredientPriceCents)) {
    if (errors[priceKey(id)] !== undefined) next.ingredientPriceCents[id] = cents;
  }
  for (const [id, milli] of Object.entries(previous.lineQtyMilli)) {
    if (errors[qtyKey(id)] !== undefined) next.lineQtyMilli[id] = milli;
  }
  return next;
}

export type ScenarioAction =
  | { type: 'added'; draft: ScenarioDraft }
  | { type: 'removed'; key: string }
  | { type: 'renamed'; key: string; name: string }
  | { type: 'fieldsChanged'; key: string; fields: FieldsDraft }
  /** `overrides` are the changes as stored (including the sales estimate the result was calculated with). */
  | { type: 'saved'; key: string; id: string; createdAt: string; overrides: ScenarioOverrides }
  /** New baseline in the draft only; nothing is saved. */
  | { type: 'rebased'; key: string; baseline: Baseline; rebased: Rebased }
  | { type: 'notesDismissed'; key: string };

function update(drafts: ScenarioDraft[], key: string, change: (draft: ScenarioDraft) => ScenarioDraft) {
  return drafts.map((draft) => (draft.key === key ? change(draft) : draft));
}

export function scenariosReducer(drafts: ScenarioDraft[], action: ScenarioAction): ScenarioDraft[] {
  switch (action.type) {
    case 'added':
      return drafts.length >= MAX_SCENARIOS ? drafts : [...drafts, action.draft];
    case 'removed':
      return drafts.filter((draft) => draft.key !== action.key);
    case 'renamed':
      return update(drafts, action.key, (draft) => ({ ...draft, name: action.name }));
    case 'fieldsChanged':
      return update(drafts, action.key, (draft) => {
        const parsed = parseFields(action.fields, draft.baseline);
        return {
          ...draft,
          fields: action.fields,
          errors: parsed.errors,
          applied: keepPrevious(draft.applied, parsed.overrides, parsed.errors),
        };
      });
    case 'saved':
      return update(drafts, action.key, (draft) => ({
        ...draft,
        id: action.id,
        createdAt: action.createdAt,
        applied: action.overrides,
        fields: { ...draft.fields, volume: action.overrides.monthlyVolume === undefined ? '' : String(action.overrides.monthlyVolume) },
        savedSignature: signature(draft.name, action.overrides),
        baselineUpdated: false,
      }));
    case 'rebased':
      return update(drafts, action.key, (draft) => {
        const { rebased } = action;
        // Keep what was typed (wrong entries too); clear only the fields whose change was dropped.
        const prices = { ...draft.fields.prices };
        for (const id of rebased.droppedPriceIds) delete prices[id];
        const qty = { ...emptyFields(action.baseline).qty };
        for (const [id, value] of Object.entries(draft.fields.qty)) {
          if (id in qty && !rebased.droppedLineIds.includes(id)) qty[id] = value;
        }
        const fields: FieldsDraft = { ...draft.fields, prices, qty };
        const parsed = parseFields(fields, action.baseline);
        return {
          ...draft,
          baseline: action.baseline,
          fields,
          errors: parsed.errors,
          applied: keepPrevious(rebased.overrides, parsed.overrides, parsed.errors),
          notes: rebased.dropped,
          baselineUpdated: true,
        };
      });
    case 'notesDismissed':
      return update(drafts, action.key, (draft) => ({ ...draft, notes: [] }));
  }
}
