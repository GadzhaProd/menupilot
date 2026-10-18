import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { packUnitPriceDisplay } from '@/ui/domain/calc';
import type { BaseUnit } from '@/ui/domain/types';
import { validatePrice, type FieldErrors, type PriceDraft, type PriceField } from '@/ui/forms/ingredientForm';
import { ALL_UNITS, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';

interface PriceFieldsProps {
  draft: PriceDraft;
  onChange: (next: PriceDraft) => void;
  errors: FieldErrors<PriceField>;
  /** The ingredient's stored unit when it is known (New price); null while creating one. */
  base: BaseUnit | null;
}

/** Pack size, pack price excl. VAT, and the equivalent price per kg, l or pc as you type. */
export function PriceFields({ draft, onChange, errors, base }: PriceFieldsProps) {
  const units: readonly EnteredUnit[] = base === null ? ALL_UNITS : unitsFor(base);
  const parsed = validatePrice(draft, base);
  const perUnit = parsed.ok ? packUnitPriceDisplay(parsed.value.packPriceCents, parsed.value.packSizeMilli, parsed.value.unit) : null;

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-2">
        <FormField label="Pack size" error={errors.packSize} hint="What you buy in one pack, as on the invoice.">
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              autoComplete="off"
              value={draft.packSize}
              onChange={(event) => onChange({ ...draft, packSize: event.target.value })}
              placeholder="1"
            />
          )}
        </FormField>
        <FormField label="Unit">
          {(control) => (
            <Select
              {...control}
              value={draft.packSizeUnit}
              onChange={(event) => onChange({ ...draft, packSizeUnit: event.target.value as EnteredUnit })}
            >
              {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </Select>
          )}
        </FormField>
      </div>
      <FormField label="Pack price (€, excl. VAT)" error={errors.packPrice} hint="Supplier price excl. VAT, as on the invoice">
        {(control) => (
          <Input
            {...control}
            inputMode="decimal"
            autoComplete="off"
            value={draft.packPrice}
            onChange={(event) => onChange({ ...draft, packPrice: event.target.value })}
            placeholder="11.20"
          />
        )}
      </FormField>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {perUnit === null ? 'Fill in the pack size and price to see the price per kg, l or pc.' : <>That is <strong className="text-foreground">{perUnit}</strong> excl. VAT.</>}
      </p>
    </>
  );
}
