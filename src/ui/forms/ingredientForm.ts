/** Draft and validation for the ingredient dialogs (add, new price, rename). Pure: no store, no DOM. */
import { normalizeUnit } from '@/ui/domain/calc';
import type { BaseUnit, IngredientInput, PriceInput } from '@/ui/domain/types';
import {
  parseMoneyField, parseQuantityField, unitsFor, type EnteredUnit,
} from './numbers';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface IngredientValidationCopy {
  nameEmpty: string; nameLong: string; packSize: string; packPrice: string; wrongUnit(unit: BaseUnit, units: readonly EnteredUnit[]): string;
}

const EN_VALIDATION: IngredientValidationCopy = {
  nameEmpty: 'Enter a name.', nameLong: 'Use at most 200 characters.',
  packSize: 'Pack size must be greater than zero.', packPrice: 'Pack price excl. VAT must be a non-negative amount.',
  wrongUnit: (unit, units) => `This ingredient is measured in ${unit}. Use ${units.join(' or ')}.`,
};

export function validateName(text: string, copy: IngredientValidationCopy = EN_VALIDATION): { ok: true; value: string } | { ok: false; error: string } {
  const name = text.trim();
  if (name === '') return { ok: false, error: copy.nameEmpty };
  if (name.length > 200) return { ok: false, error: copy.nameLong };
  return { ok: true, value: name };
}

export interface PriceDraft {
  packSize: string;
  packSizeUnit: EnteredUnit;
  packPrice: string;
}

export type PriceField = 'packSize' | 'packPrice';

/**
 * Pack size and pack price (excl. VAT) as typed. `base` is the ingredient's stored unit when it
 * is already known (New price); the size unit must then be of the same kind.
 */
export function validatePrice(
  draft: PriceDraft,
  base: BaseUnit | null,
  copy: IngredientValidationCopy = EN_VALIDATION,
): { ok: true; value: PriceInput & { unit: BaseUnit } } | { ok: false; errors: FieldErrors<PriceField> } {
  const errors: FieldErrors<PriceField> = {};
  const size = parseQuantityField(draft.packSize, draft.packSizeUnit, copy.packSize);
  const price = parseMoneyField(draft.packPrice, copy.packPrice);
  if (!size.ok) {
    errors.packSize = copy.packSize;
  } else if (base !== null && size.value.unit !== base) {
    errors.packSize = copy.wrongUnit(base, unitsFor(base));
  }
  if (!price.ok) errors.packPrice = copy.packPrice;
  if (!size.ok || !price.ok || errors.packSize) return { ok: false, errors };
  return {
    ok: true,
    value: { packPriceCents: price.value, packSizeMilli: size.value.milli, unit: size.value.unit },
  };
}

export interface IngredientDraft extends PriceDraft {
  name: string;
}

export type IngredientField = 'name' | PriceField;

/**
 * A new ingredient. Pack size and price may both be left empty: the ingredient is then saved
 * without a price and recipes using it show "cost unknown" until one is added.
 */
export function validateNewIngredient(
  draft: IngredientDraft,
  copy: IngredientValidationCopy = EN_VALIDATION,
): { ok: true; value: IngredientInput } | { ok: false; errors: FieldErrors<IngredientField> } {
  const errors: FieldErrors<IngredientField> = {};
  const name = validateName(draft.name, copy);
  if (!name.ok) errors.name = name.error;

  const sizeEmpty = draft.packSize.trim() === '';
  const priceEmpty = draft.packPrice.trim() === '';
  if (sizeEmpty && priceEmpty) {
    if (!name.ok) return { ok: false, errors };
    // Without a price only the stored unit matters.
    return { ok: true, value: { name: name.value, unit: normalizeUnit(draft.packSizeUnit) } };
  }
  const price = validatePrice(draft, null, copy);
  if (!price.ok) Object.assign(errors, price.errors);
  if (!name.ok || !price.ok) return { ok: false, errors };
  const { unit, ...priceInput } = price.value;
  return { ok: true, value: { name: name.value, unit, price: priceInput } };
}
