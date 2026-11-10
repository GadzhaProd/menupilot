import { useId, useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { MoneyField, QuantityField } from '@/components/numeric-field';
import { FormField } from '@/components/form-field';
import { useLocale, useFormatters } from '@/ui/i18n';
import type { BaseUnit, PriceRecord } from '@/ui/domain/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TriangleAlert } from 'lucide-react';
import { isZeroPrice, validatePrice, type DateRange, type FieldErrors, type IngredientValidationCopy, type PriceDraft, type PriceField } from '@/ui/forms/ingredientForm';
import { ALL_UNITS, localizedUnit, parseMoneyField, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';

function priceError(text: string, t: (key: 'prices.priceEmpty' | 'prices.priceNumber' | 'prices.pricePrecision' | 'prices.priceNegative' | 'prices.priceTooLarge') => string): string {
  const value = text.trim().replace(/^€\s*/, '');
  if (value === '') return t('prices.priceEmpty');
  if (/^-/.test(value)) return t('prices.priceNegative');
  if (/^\d+[.,]\d{3,}$/.test(value)) return t('prices.pricePrecision');
  if (!parseMoneyField(text, '').ok && /^\d+(?:[.,]\d{1,2})?$/.test(value)) return t('prices.priceTooLarge');
  return t('prices.priceNumber');
}

interface PriceFieldsProps {
  draft: PriceDraft;
  onChange: (next: PriceDraft) => void;
  errors: FieldErrors<PriceField>;
  /** The ingredient's stored unit when it is known (New price); null while creating one. */
  base: BaseUnit | null;
  /** Allowed "Price valid from" days: from 2000-01-01 to today. */
  range: DateRange;
  prices?: readonly PriceRecord[];
}

/** Validation messages in the current language, shared by the ingredient dialogs. */
export function useValidationCopy(): IngredientValidationCopy {
  const { t, locale } = useLocale();
  const f = useFormatters();
  return useMemo(() => ({
    nameEmpty: t('ingredients.error.name'), nameLong: t('ingredients.error.nameLong'), packSize: t('ingredients.error.packSize'),
    packPrice: t('ingredients.error.packPrice'), wrongUnit: (unit, units) => t('ingredients.error.unit', { unit: localizedUnit(unit, locale), units: units.map((entry) => localizedUnit(entry, locale)).join(` ${t('common.or')} `) }),
    zeroUnconfirmed: t('prices.zeroUnconfirmed'),
    validFromInvalid: t('prices.validFromInvalid'),
    validFromFuture: t('prices.validFromFuture'),
    validFromEarlier: (date) => t('prices.validFromEarlier', { date: f.date(`${date}T00:00:00.000Z`) }),
  }), [t, locale, f]);
}

/** Pack size, pack price excl. VAT, and the equivalent price per kg, l or pc as you type. */
export function PriceFields({ draft, onChange, errors, base, range, prices = [] }: PriceFieldsProps) {
  const { t, locale } = useLocale();
  const f = useFormatters();
  const copy = useValidationCopy();
  const units: readonly EnteredUnit[] = base === null ? ALL_UNITS : unitsFor(base);
  // The live preview does not need the zero confirmation or the date.
  const parsed = validatePrice({ ...draft, confirmZero: true, validFrom: '' }, base, copy);
  const zero = isZeroPrice(draft);
  const duplicateDay = prices.some(price => new Date(price.recordedAt).toISOString().slice(0, 10) === (draft.validFrom || range.max));
  const zeroId = useId();
  const perUnit = parsed.ok ? f.packPrice(parsed.value.packPriceCents, parsed.value.packSizeMilli, parsed.value.unit) : null;
  const displayedPriceError = errors.packPrice ? priceError(draft.packPrice, t) : undefined;

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-2">
        <QuantityField
          label={t('ingredients.packSize')}
          unit={localizedUnit(draft.packSizeUnit, locale)}
          error={errors.packSize}
          hint={t('ingredients.packHint')}
          autoComplete="off"
          value={draft.packSize}
          onValueChange={(packSize) => onChange({ ...draft, packSize })}
          placeholder="1"
        />
        <FormField label={t('ingredients.unitLabel')}>
          {(control) => (
            <Select
              {...control}
              value={draft.packSizeUnit}
              onChange={(event) => onChange({ ...draft, packSizeUnit: event.target.value as EnteredUnit })}
            >
              {units.map((unit) => <option key={unit} value={unit}>{localizedUnit(unit, locale)}</option>)}
            </Select>
          )}
        </FormField>
      </div>
      <MoneyField
        vat="excl"
        supplier
        label={t('ingredients.packPriceInput')}
        error={displayedPriceError}
        autoComplete="off"
        value={draft.packPrice}
        onValueChange={(packPrice) => onChange({ ...draft, packPrice, confirmZero: false })}
        placeholder={t('ingredients.priceExample')}
      />
      {zero ? (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription>
            <p className="font-medium">{t('prices.zeroWarning')}</p>
            <div className="flex items-start gap-2 pt-1">
              <input
                id={zeroId}
                type="checkbox"
                className="mt-0.5 size-5 shrink-0 accent-current"
                checked={draft.confirmZero === true}
                aria-invalid={errors.confirmZero ? true : undefined}
                aria-describedby={errors.confirmZero ? `${zeroId}-error` : undefined}
                onChange={(event) => onChange({ ...draft, confirmZero: event.target.checked })}
              />
              <Label htmlFor={zeroId} className="font-normal">{t('prices.zeroConfirm')}</Label>
            </div>
            {errors.confirmZero ? <p id={`${zeroId}-error`} className="text-xs font-medium text-destructive">{errors.confirmZero}</p> : null}
          </AlertDescription>
        </Alert>
      ) : null}
      <FormField label={t('prices.validFrom')} hint={t('prices.validFromHint')} error={errors.validFrom}>
        {(control) => (
          <Input
            {...control}
            type="date"
            min={range.min ?? undefined}
            max={range.max}
            value={draft.validFrom ?? range.max}
            onChange={(event) => onChange({ ...draft, validFrom: event.target.value })}
            className="w-auto max-w-full"
          />
        )}
      </FormField>
      {duplicateDay ? <p role="status" className="text-sm text-muted-foreground">{t('prices.sameDayWarning')}</p> : null}
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {perUnit === null ? t('ingredients.fillPriceToSee') : <>{t('ingredients.perUnitPreview')} <strong className="text-foreground">{perUnit}</strong> {t('common.exclVat')}.</>}
      </p>
    </>
  );
}
