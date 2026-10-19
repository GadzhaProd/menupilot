/**
 * Parsing and printing of what the owner types into forms. Every value is read from text
 * (never parseFloat) and ends up as a safe integer, the way the store keeps it.
 * Money and quantities are parsed by src/calc; this file only adds empty-field messages,
 * whole numbers and percentages, and the reverse direction (stored integer to input text).
 */
import { normalizeUnit, parseMoneyToCents, parseQuantityToMilli } from '@/ui/domain/calc';
import type { BaseUnit } from '@/ui/domain/types';
import { createTranslator, type Locale } from '@/ui/i18n';

/** Units the owner can type. Stored values are always g, ml or pc. */
export type EnteredUnit = 'g' | 'kg' | 'ml' | 'l' | 'pc';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function attempt<T>(run: () => T): ParseResult<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'This value cannot be used.');
  }
}

/** The units that can be typed for something stored in `base` (g and kg for weight, and so on). */
export function unitsFor(base: BaseUnit): EnteredUnit[] {
  if (base === 'g') return ['g', 'kg'];
  if (base === 'ml') return ['ml', 'l'];
  return ['pc'];
}

export const ALL_UNITS: readonly EnteredUnit[] = ['g', 'kg', 'ml', 'l', 'pc'];

/** Euro amount to cents. `emptyMessage` is shown when nothing was typed. */
export function parseMoneyField(text: string, emptyMessage: string): ParseResult<number> {
  if (text.trim() === '') return fail(emptyMessage);
  return attempt(() => parseMoneyToCents(text));
}

export function parseQuantityField(
  text: string,
  unit: EnteredUnit,
  emptyMessage: string,
): ParseResult<{ unit: BaseUnit; milli: number }> {
  if (text.trim() === '') return fail(emptyMessage);
  return attempt(() => {
    const parsed = parseQuantityToMilli(text, unit);
    return { unit: parsed.unit, milli: parsed.quantityMilli };
  });
}

/** A whole number, `min` or more. */
export function parseWholeNumber(text: string, min: number, message: string): ParseResult<number> {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return fail(message);
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < min) return fail(message);
  return { ok: true, value };
}

/** Yield in percent ("100", "85,5") to basis points (10000 = 100 %). Must be above 0 and at most 100. */
export function parseYieldPercent(text: string): ParseResult<number> {
  const message = 'Enter a yield from 0.01 to 100 percent, for example 100 or 85.5.';
  const match = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return fail(message);
  const basisPoints = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  return basisPoints >= 1 && basisPoints <= 10_000 ? { ok: true, value: basisPoints } : fail(message);
}

/* ---- stored integer to input text ---- */

/** value / scale as text without trailing zeros, using integer arithmetic only. */
function scaled(value: number, scale: 1_000 | 1_000_000): string {
  const remainder = value % scale;
  const whole = (value - remainder) / scale;
  const fraction = String(remainder).padStart(scale === 1_000 ? 3 : 6, '0').replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${whole}.${fraction}`;
}

/** Cents to the text of a money field: 1250 becomes "12.50". */
export function centsToInput(cents: number): string {
  const remainder = cents % 100;
  return `${(cents - remainder) / 100}.${String(remainder).padStart(2, '0')}`;
}

/** Basis points to the text of a percent field: 10000 becomes "100", 8550 becomes "85.5". */
export function basisPointsToInput(basisPoints: number): string {
  const remainder = basisPoints % 100;
  const whole = (basisPoints - remainder) / 100;
  const fraction = String(remainder).padStart(2, '0').replace(/0+$/, '');
  return fraction === '' ? String(whole) : `${whole}.${fraction}`;
}

/**
 * A stored quantity (thousandths of g, ml or pc) as the text and unit a person would type:
 * 1 500 000 g-thousandths is "1.5 kg", 250 000 is "250 g".
 */
export function quantityToInput(milli: number, base: BaseUnit): { text: string; unit: EnteredUnit } {
  if (base !== 'pc' && milli >= 1_000_000 && milli % 1_000 === 0) {
    return { text: scaled(milli, 1_000_000), unit: base === 'g' ? 'kg' : 'l' };
  }
  return { text: scaled(milli, 1_000), unit: base };
}

/** "250 g", "1.5 kg", "8 pc". */
export function formatQuantity(milli: number, base: BaseUnit): string {
  const { text, unit } = quantityToInput(milli, base);
  return `${text} ${unit}`;
}

/** Localized display for stored quantities; values and units remain separate in the document. */
export function localizedUnit(unit: EnteredUnit, locale: Locale): string {
  const key = unit === 'kg' ? 'units.kg' : unit === 'l' ? 'units.l' : unit === 'pc' ? 'units.pc' : unit === 'g' ? 'units.g' : 'units.ml';
  return createTranslator(locale)(key);
}

export function formatQuantityLocale(milli: number, base: BaseUnit, locale: Locale): string {
  const value = quantityToInput(milli, base);
  return `${value.text} ${localizedUnit(value.unit, locale)}`;
}

/** Tenths of a percent as text: 285n becomes "28.5%". Works on BigInt, never converts to Number. */
export function formatTenthsPct(tenths: bigint): string {
  const negative = tenths < 0n;
  const absolute = negative ? -tenths : tenths;
  return `${negative ? '-' : ''}${absolute / 10n}.${absolute % 10n}%`;
}

/** Same unit family and base unit check used by line forms. */
export function isUnitOf(unit: EnteredUnit, base: BaseUnit): boolean {
  return normalizeUnit(unit) === base;
}
