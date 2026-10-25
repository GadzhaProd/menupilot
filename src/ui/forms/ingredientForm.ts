/** Draft and validation for the ingredient dialogs (add, new price, rename). Pure: no store, no DOM. */
import { normalizeUnit } from '@/ui/domain/calc';
import type { BaseUnit, IngredientInput, PriceInput } from '@/ui/domain/types';
import {
  parseMoneyField, parseQuantityField, unitsFor, type EnteredUnit,
} from './numbers';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export interface IngredientValidationCopy {
  nameEmpty: string; nameLong: string; packSize: string; packPrice: string; wrongUnit(unit: BaseUnit, units: readonly EnteredUnit[]): string;
  /** A zero price needs the owner's explicit confirmation. */
  zeroUnconfirmed?: string;
  validFromInvalid?: string; validFromFuture?: string;
  /** `date` is the previous price's day, `YYYY-MM-DD`. */
  validFromEarlier?(date: string): string;
}

const EN_VALIDATION: IngredientValidationCopy = {
  nameEmpty: 'Enter a name.', nameLong: 'Use at most 200 characters.',
  packSize: 'Pack size must be greater than zero.', packPrice: 'Pack price excl. VAT must be a non-negative amount.',
  wrongUnit: (unit, units) => `This ingredient is measured in ${unit}. Use ${units.join(' or ')}.`,
  zeroUnconfirmed: 'Tick the box to confirm a free product, or clear the price if you do not know it.',
  validFromInvalid: 'Enter a valid date.',
  validFromFuture: 'The date cannot be in the future.',
  validFromEarlier: (date) => `The date cannot be earlier than the previous price (${date}).`,
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
  /** "Price valid from" as `YYYY-MM-DD` (UTC day). Empty or missing means today. */
  validFrom?: string;
  /** The owner ticked "this product really is free". Needed to save a price of 0. */
  confirmZero?: boolean;
}

export type PriceField = 'packSize' | 'packPrice' | 'confirmZero' | 'validFrom';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Today as `YYYY-MM-DD`: the UTC calendar day, like every date in MenuPilot (Dashboard comparison, history). */
export function todayInput(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The UTC day of the newest price (the earliest "valid from" day the next one may have), or null. */
export function lastPriceDay(prices: readonly { recordedAt: string }[]): string | null {
  const last = prices.at(-1);
  return last ? new Date(last.recordedAt).toISOString().slice(0, 10) : null;
}

/** True when the draft's price is exactly zero (it parses and is 0): the warning and the checkbox are shown. */
export function isZeroPrice(draft: Pick<PriceDraft, 'packPrice'>): boolean {
  const price = parseMoneyField(draft.packPrice, '');
  return price.ok && price.value === 0;
}

export interface DateRange {
  /** Earliest allowed day: the day of the previous price. */
  min: string | null;
  /** Latest allowed day: today. */
  max: string;
}

/**
 * Pack size and pack price (excl. VAT) as typed. `base` is the ingredient's stored unit when it
 * is already known (New price); the size unit must then be of the same kind.
 */
export function validatePrice(
  draft: PriceDraft,
  base: BaseUnit | null,
  copy: IngredientValidationCopy = EN_VALIDATION,
  range?: DateRange,
): { ok: true; value: PriceInput & { unit: BaseUnit; effectiveDate?: string } } | { ok: false; errors: FieldErrors<PriceField> } {
  const errors: FieldErrors<PriceField> = {};
  const size = parseQuantityField(draft.packSize, draft.packSizeUnit, copy.packSize);
  const price = parseMoneyField(draft.packPrice, copy.packPrice);
  if (!size.ok) {
    errors.packSize = copy.packSize;
  } else if (base !== null && size.value.unit !== base) {
    errors.packSize = copy.wrongUnit(base, unitsFor(base));
  }
  if (!price.ok) errors.packPrice = copy.packPrice;
  else if (price.value === 0 && !draft.confirmZero) errors.confirmZero = copy.zeroUnconfirmed ?? EN_VALIDATION.zeroUnconfirmed;
  const day = draft.validFrom?.trim() ?? '';
  if (day !== '' && range) {
    if (!DAY.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00.000Z`)) || new Date(`${day}T00:00:00.000Z`).toISOString().slice(0, 10) !== day) {
      errors.validFrom = copy.validFromInvalid ?? EN_VALIDATION.validFromInvalid;
    } else if (day > range.max) {
      errors.validFrom = copy.validFromFuture ?? EN_VALIDATION.validFromFuture;
    } else if (range.min !== null && day < range.min) {
      errors.validFrom = (copy.validFromEarlier ?? EN_VALIDATION.validFromEarlier!)(range.min);
    }
  }
  if (!size.ok || !price.ok || Object.keys(errors).length > 0) return { ok: false, errors };
  // Today needs no date: the store records "now". Only another day is passed on.
  const effectiveDate = day !== '' && range && day !== range.max ? day : undefined;
  return {
    ok: true,
    value: {
      packPriceCents: price.value, packSizeMilli: size.value.milli, unit: size.value.unit, ...(effectiveDate && { effectiveDate }),
    },
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
  range?: DateRange,
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
  const price = validatePrice(draft, null, copy, range);
  if (!price.ok) Object.assign(errors, price.errors);
  if (!name.ok || !price.ok) return { ok: false, errors };
  const { unit, effectiveDate, ...priceInput } = price.value;
  return { ok: true, value: { name: name.value, unit, price: priceInput, ...(effectiveDate && { effectiveDate }) } };
}
