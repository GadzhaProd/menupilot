/**
 * What the owner types into one scenario, and how it becomes `ScenarioOverrides`.
 * An empty field means "leave as in Baseline". Money and quantities are read from text by
 * src/calc (never parseFloat); the other direction prints stored integers back as text.
 */
import type { Baseline } from '@/ui/domain/types';
import {
  dishLines, ingredientInfos, NO_CHANGES, type ScenarioOverrides,
} from '@/ui/domain/simulator';
import {
  centsToInput, parseMoneyField, parseQuantityField, parseWholeNumber, quantityToInput, unitsFor,
  type EnteredUnit,
} from '@/ui/forms/numbers';

export interface QtyDraft {
  text: string;
  unit: EnteredUnit;
}

export interface FieldsDraft {
  menuPrice: string;
  /** This scenario's own sales estimate; empty = use the shared one. */
  volume: string;
  /** Ingredient id to pack price text. */
  prices: Record<string, string>;
  /** Top-level line id to quantity text and unit. */
  qty: Record<string, QtyDraft>;
}

/** Field keys used for error messages. */
export const priceKey = (ingredientId: string) => `price:${ingredientId}`;
export const qtyKey = (lineId: string) => `qty:${lineId}`;
export type FieldErrors = Record<string, string>;

export const VOLUME_MESSAGE = 'Enter a whole number of 0 or more, for example 300.';
const MAX_NAME = 60;

/** Fields of a scenario that changes nothing yet. */
export function emptyFields(baseline: Baseline): FieldsDraft {
  const qty: Record<string, QtyDraft> = {};
  for (const line of dishLines(baseline)) {
    if (line.refKind === 'ingredient') qty[line.id] = { text: '', unit: unitsFor(line.unit)[0] ?? line.unit };
  }
  return { menuPrice: '', volume: '', prices: {}, qty };
}

/** The text a saved scenario's changes would have been typed as. */
export function fieldsFromOverrides(overrides: ScenarioOverrides, baseline: Baseline): FieldsDraft {
  const fields = emptyFields(baseline);
  if (overrides.menuPriceInclVatCents !== undefined) fields.menuPrice = centsToInput(overrides.menuPriceInclVatCents);
  if (overrides.monthlyVolume !== undefined) fields.volume = String(overrides.monthlyVolume);
  for (const [id, cents] of Object.entries(overrides.ingredientPriceCents)) fields.prices[id] = centsToInput(cents);
  for (const line of dishLines(baseline)) {
    const milli = overrides.lineQtyMilli[line.id];
    if (milli !== undefined && line.refKind === 'ingredient') fields.qty[line.id] = quantityToInput(milli, line.unit);
  }
  return fields;
}

/** Overrides as the store keeps them, from the values the schema allows (nothing else). */
export function sanitizeOverrides(stored: {
  menuPriceInclVatCents?: number | null;
  monthlyVolume?: number | null;
  ingredientPriceCents?: Readonly<Record<string, number | null>> | null;
  lineQtyMilli?: Readonly<Record<string, number | null>> | null;
}): ScenarioOverrides {
  const keep = (map: Readonly<Record<string, number | null>> | null | undefined) => Object.fromEntries(
    Object.entries(map ?? {}).flatMap(([id, value]) => (value === null || value === undefined ? [] : [[id, value]])),
  );
  return {
    ...(stored.menuPriceInclVatCents != null && { menuPriceInclVatCents: stored.menuPriceInclVatCents }),
    ...(stored.monthlyVolume != null && { monthlyVolume: stored.monthlyVolume }),
    ingredientPriceCents: keep(stored.ingredientPriceCents),
    lineQtyMilli: keep(stored.lineQtyMilli),
  };
}

export interface ParsedFields {
  overrides: ScenarioOverrides;
  errors: FieldErrors;
}

/** Turn what was typed into overrides; every field that cannot be read gets its own message. */
export function parseFields(fields: FieldsDraft, baseline: Baseline): ParsedFields {
  const errors: FieldErrors = {};
  const overrides: ScenarioOverrides = { ingredientPriceCents: {}, lineQtyMilli: {} };

  if (fields.menuPrice.trim() !== '') {
    const parsed = parseMoneyField(fields.menuPrice, '');
    if (parsed.ok) overrides.menuPriceInclVatCents = parsed.value;
    else errors.menuPrice = `${parsed.error} Example: 13.83`;
  }
  if (fields.volume.trim() !== '') {
    const parsed = parseWholeNumber(fields.volume, 0, VOLUME_MESSAGE);
    if (parsed.ok) overrides.monthlyVolume = parsed.value;
    else errors.volume = parsed.error;
  }
  for (const info of ingredientInfos(baseline)) {
    const text = fields.prices[info.id] ?? '';
    if (text.trim() === '') continue;
    const parsed = parseMoneyField(text, '');
    if (parsed.ok) overrides.ingredientPriceCents[info.id] = parsed.value;
    else errors[priceKey(info.id)] = `${parsed.error} Example: 11.20`;
  }
  for (const line of dishLines(baseline)) {
    const draft = fields.qty[line.id];
    if (line.refKind !== 'ingredient' || !draft || draft.text.trim() === '') continue;
    const parsed = parseQuantityField(draft.text, draft.unit, '');
    if (!parsed.ok) errors[qtyKey(line.id)] = parsed.error;
    else if (parsed.value.milli < 1) errors[qtyKey(line.id)] = 'The quantity must be more than 0.';
    else overrides.lineQtyMilli[line.id] = parsed.value.milli;
  }
  return { overrides, errors };
}

/** Parse the shared sales estimate; empty is allowed only when the dish has none saved. */
export function parseSharedVolume(text: string, dishHasVolume: boolean): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (text.trim() === '') {
    return dishHasVolume
      ? { ok: false, error: 'Enter your estimate (0 if you do not want a monthly figure).' }
      : { ok: true, value: undefined };
  }
  const parsed = parseWholeNumber(text, 0, VOLUME_MESSAGE);
  return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error: parsed.error };
}

export function validateName(name: string): string | null {
  if (name.trim() === '') return 'Give the scenario a name.';
  if (name.length > MAX_NAME) return `Use at most ${MAX_NAME} characters.`;
  return null;
}
export const NAME_MAX_LENGTH = MAX_NAME;

/** Stable text of the changes, to tell whether anything differs from what is saved. */
export function signature(name: string, overrides: ScenarioOverrides): string {
  const sorted = (map: Record<string, number>) => Object.keys(map).sort().map((key) => [key, map[key]]);
  return JSON.stringify([
    name.trim(),
    overrides.menuPriceInclVatCents ?? null,
    overrides.monthlyVolume ?? null,
    sorted(overrides.ingredientPriceCents),
    sorted(overrides.lineQtyMilli),
  ]);
}

/** How many separate things the scenario changes, apart from the sales estimate. */
export function countChanges(overrides: ScenarioOverrides) {
  return {
    price: overrides.menuPriceInclVatCents === undefined ? 0 : 1,
    ingredients: Object.keys(overrides.ingredientPriceCents).length,
    quantities: Object.keys(overrides.lineQtyMilli).length,
  };
}

export { NO_CHANGES };
