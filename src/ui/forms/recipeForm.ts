/**
 * Draft and validation for the recipe editor (dish and prep). Pure: no store, no DOM.
 * The draft holds exactly what the owner typed; `buildRecipe` turns it into the stored shape
 * or into one message per field. Cost is never calculated here (that is src/calc).
 */
import type {
  BaseUnit, MenuDocument, Recipe, RecipeInput, RecipeLine,
} from '@/ui/domain/types';
import { validateName } from './ingredientForm';
import {
  basisPointsToInput, centsToInput, isUnitOf, parseMoneyField, parseQuantityField, parseWholeNumber,
  parseYieldPercent, quantityToInput, unitsFor, type EnteredUnit,
} from './numbers';

export type Catalog = Pick<MenuDocument, 'ingredients' | 'recipes'>;

export interface LineDraft {
  /** Stable id of the stored line (kept when editing, so scenarios keep pointing at it). */
  id: string;
  /** "ingredient:<id>" or "prep:<id>"; empty until chosen. */
  ref: string;
  qty: string;
  unit: EnteredUnit;
  yieldPct: string;
  /** The stored quantity this line was opened with; reused while qty and unit are untouched. */
  stored: { milli: number; qty: string; unit: EnteredUnit } | null;
}

export interface RecipeDraft {
  kind: 'dish' | 'prep';
  name: string;
  // dish
  menuPrice: string;
  vatRateBp: string;
  portions: string;
  monthlyVolume: string;
  // prep
  outputQty: string;
  outputUnit: EnteredUnit;
  lines: LineDraft[];
}

export type FieldErrors = Record<string, string>;

export const lineErrorKey = (line: Pick<LineDraft, 'id'>, field: 'ref' | 'qty' | 'yield') => `line:${line.id}:${field}`;

export function newLineId(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(6));
  return `line_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export function emptyLine(): LineDraft {
  return { id: newLineId(), ref: '', qty: '', unit: 'g', yieldPct: '100', stored: null };
}

export const refKey = (ref: { kind: string; id: string }) => `${ref.kind}:${ref.id}`;

function splitRef(key: string): { kind: 'ingredient' | 'prep'; id: string } | null {
  const separator = key.indexOf(':');
  const kind = key.slice(0, separator);
  const id = key.slice(separator + 1);
  return (kind === 'ingredient' || kind === 'prep') && id !== '' ? { kind, id } : null;
}

/** The stored unit of what a line points at (ingredient unit, or prep output unit). */
export function baseUnitOfRef(key: string, catalog: Catalog): BaseUnit | null {
  const ref = splitRef(key);
  if (ref === null) return null;
  if (ref.kind === 'ingredient') return catalog.ingredients.find((entry) => entry.id === ref.id)?.unit ?? null;
  const prep = catalog.recipes.find((entry) => entry.id === ref.id && entry.kind === 'prep');
  return prep?.kind === 'prep' ? prep.outputUnit : null;
}

export function blankDraft(kind: 'dish' | 'prep', defaultVatRateBp: number): RecipeDraft {
  return {
    kind,
    name: '',
    menuPrice: '',
    vatRateBp: String(defaultVatRateBp),
    portions: '1',
    monthlyVolume: '',
    outputQty: '',
    outputUnit: 'g',
    lines: [emptyLine()],
  };
}

function lineToDraft(line: RecipeLine, catalog: Catalog): LineDraft {
  const base = baseUnitOfRef(refKey(line.ref), catalog) ?? 'g';
  const { text, unit } = quantityToInput(line.netQtyMilli, base);
  return {
    id: line.id,
    ref: refKey(line.ref),
    qty: text,
    unit,
    yieldPct: basisPointsToInput(line.yieldBp),
    stored: { milli: line.netQtyMilli, qty: text, unit },
  };
}

export function draftFromRecipe(recipe: Recipe, catalog: Catalog): RecipeDraft {
  const lines = recipe.lines.map((line) => lineToDraft(line, catalog));
  if (recipe.kind === 'dish') {
    return {
      ...blankDraft('dish', recipe.vatRateBp),
      name: recipe.name,
      menuPrice: centsToInput(recipe.menuPriceInclVatCents),
      portions: String(recipe.portions),
      monthlyVolume: recipe.monthlyVolume === null || recipe.monthlyVolume === undefined ? '' : String(recipe.monthlyVolume),
      lines,
    };
  }
  const output = quantityToInput(recipe.outputMilli, recipe.outputUnit);
  return {
    ...blankDraft('prep', 900),
    name: recipe.name,
    outputQty: output.text,
    outputUnit: output.unit,
    lines,
  };
}

/** VAT choices: 9 % (default), 21 %, 0 %, plus the dish's own rate when it is something else. */
export function vatOptions(currentBp: string): { value: string; label: string }[] {
  const standard = [900, 2100, 0].map((bp) => ({ value: String(bp), label: `${bp / 100}%` }));
  if (standard.some((option) => option.value === currentBp)) return standard;
  const bp = Number(currentBp);
  return [...standard, { value: currentBp, label: `${Number.isFinite(bp) ? bp / 100 : currentBp}%` }];
}

export type LineParse =
  | { ok: true; line: RecipeLine }
  | { ok: false; errors: FieldErrors };

/** Check one line. `selfId` is the prep being edited: it cannot use itself. */
export function parseLine(draft: LineDraft, selfId: string | null, catalog: Catalog): LineParse {
  const errors: FieldErrors = {};
  const ref = splitRef(draft.ref);
  const base = baseUnitOfRef(draft.ref, catalog);
  if (ref === null || base === null) {
    errors[lineErrorKey(draft, 'ref')] = 'Choose an ingredient or a prep.';
  } else if (ref.kind === 'prep' && ref.id === selfId) {
    errors[lineErrorKey(draft, 'ref')] = 'A prep cannot use itself.';
  }

  let netQtyMilli = 0;
  const unchanged = draft.stored !== null && draft.stored.qty === draft.qty && draft.stored.unit === draft.unit;
  if (unchanged && draft.stored !== null) {
    netQtyMilli = draft.stored.milli;
  } else if (base !== null && !isUnitOf(draft.unit, base)) {
    errors[lineErrorKey(draft, 'qty')] = `This line is measured in ${base}. Use ${unitsFor(base).join(' or ')}.`;
  } else {
    const quantity = parseQuantityField(draft.qty, draft.unit, 'Enter a quantity, for example 150.');
    if (quantity.ok) netQtyMilli = quantity.value.milli;
    else errors[lineErrorKey(draft, 'qty')] = quantity.error;
  }

  const yieldBp = parseYieldPercent(draft.yieldPct);
  if (!yieldBp.ok) errors[lineErrorKey(draft, 'yield')] = yieldBp.error;

  if (Object.keys(errors).length > 0 || ref === null || !yieldBp.ok) return { ok: false, errors };
  return { ok: true, line: { id: draft.id, ref, netQtyMilli, yieldBp: yieldBp.value } };
}

export type BuildResult =
  | { ok: true; recipe: RecipeInput & { id: string } }
  | { ok: false; errors: FieldErrors };

/** Turn the draft into the stored shape, or collect one message per wrong field. */
export function buildRecipe(draft: RecipeDraft, id: string, catalog: Catalog): BuildResult {
  const errors: FieldErrors = {};
  const name = validateName(draft.name);
  if (!name.ok) errors.name = name.error;

  const lines: RecipeLine[] = [];
  for (const entry of draft.lines) {
    const parsed = parseLine(entry, draft.kind === 'prep' ? id : null, catalog);
    if (parsed.ok) lines.push(parsed.line);
    else Object.assign(errors, parsed.errors);
  }

  if (draft.kind === 'dish') {
    const price = parseMoneyField(draft.menuPrice, 'Enter the menu price incl. VAT, for example 13.50.');
    if (!price.ok) errors.menuPrice = price.error;
    const portions = parseWholeNumber(draft.portions, 1, 'Enter a whole number of portions, 1 or more.');
    if (!portions.ok) errors.portions = portions.error;
    const vat = parseWholeNumber(draft.vatRateBp, 0, 'Choose a VAT rate.');
    if (!vat.ok || vat.value > 10_000) errors.vatRateBp = 'Choose a VAT rate.';
    const volume = draft.monthlyVolume.trim() === ''
      ? null
      : parseWholeNumber(draft.monthlyVolume, 0, 'Enter a whole number (0 or more), or leave this empty.');
    if (volume !== null && !volume.ok) errors.monthlyVolume = volume.error;

    if (Object.keys(errors).length > 0 || !name.ok || !price.ok || !portions.ok || !vat.ok || (volume !== null && !volume.ok)) {
      return { ok: false, errors };
    }
    return {
      ok: true,
      recipe: {
        id,
        kind: 'dish',
        name: name.value,
        menuPriceInclVatCents: price.value,
        vatRateBp: vat.value,
        portions: portions.value,
        ...(volume !== null && volume.ok ? { monthlyVolume: volume.value } : {}),
        lines,
      },
    };
  }

  const output = parseQuantityField(draft.outputQty, draft.outputUnit, 'Enter how much one batch makes, for example 1 kg.');
  if (!output.ok) errors.outputQty = output.error;
  if (Object.keys(errors).length > 0 || !name.ok || !output.ok) return { ok: false, errors };
  return {
    ok: true,
    recipe: {
      id,
      kind: 'prep',
      name: name.value,
      outputMilli: output.value.milli,
      outputUnit: output.value.unit,
      lines,
    },
  };
}

/** Everything that uses a prep or ingredient: for "cannot delete" messages and locked units. */
export function recipesUsing(catalog: Catalog, kind: 'ingredient' | 'prep', id: string): Recipe[] {
  return catalog.recipes.filter((recipe) => recipe.lines.some((line) => line.ref.kind === kind && line.ref.id === id));
}
