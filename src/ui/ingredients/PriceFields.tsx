import { Select } from '@/components/ui/select';
import { MoneyField, QuantityField } from '@/components/numeric-field';
import { FormField } from '@/components/form-field';
import { useLocale, useFormatters } from '@/ui/i18n';
import type { BaseUnit } from '@/ui/domain/types';
import { validatePrice, type FieldErrors, type IngredientValidationCopy, type PriceDraft, type PriceField } from '@/ui/forms/ingredientForm';
import { ALL_UNITS, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';
import { localizedUnit } from '@/ui/forms/numbers';

interface PriceFieldsProps {
  draft: PriceDraft;
  onChange: (next: PriceDraft) => void;
  errors: FieldErrors<PriceField>;
  /** The ingredient's stored unit when it is known (New price); null while creating one. */
  base: BaseUnit | null;
}

/** Pack size, pack price excl. VAT, and the equivalent price per kg, l or pc as you type. */
export function PriceFields({ draft, onChange, errors, base }: PriceFieldsProps) {
  const { t, locale } = useLocale();
  const f = useFormatters();
  const copy: IngredientValidationCopy = {
    nameEmpty: t('ingredients.error.name'), nameLong: t('ingredients.error.nameLong'), packSize: t('ingredients.error.packSize'),
    packPrice: t('ingredients.error.packPrice'), wrongUnit: (unit, units) => t('ingredients.error.unit', { unit: localizedUnit(unit, locale), units: units.map((entry) => localizedUnit(entry, locale)).join(locale === 'nl' ? ' of ' : ' or ') }),
  };
  const units: readonly EnteredUnit[] = base === null ? ALL_UNITS : unitsFor(base);
  const parsed = validatePrice(draft, base, copy);
  const perUnit = parsed.ok ? f.packPrice(parsed.value.packPriceCents, parsed.value.packSizeMilli, parsed.value.unit) : null;

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
        error={errors.packPrice}
        autoComplete="off"
        value={draft.packPrice}
        onValueChange={(packPrice) => onChange({ ...draft, packPrice })}
        placeholder={t('ingredients.priceExample')}
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {perUnit === null ? t('ingredients.fillPriceToSee') : <>{t('ingredients.perUnitPreview')} <strong className="text-foreground">{perUnit}</strong> {t('common.exclVat')}.</>}
      </p>
    </>
  );
}
