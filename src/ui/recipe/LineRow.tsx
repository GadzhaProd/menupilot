import { Trash2Icon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { QuantityField } from '@/components/numeric-field';
import type { LineCost } from '@/ui/domain/recipeCosts';
import type { Ingredient, Prep } from '@/ui/domain/types';
import { localizedUnit, parseQuantityField, quantityToInput, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';
import {
  baseUnitOfRef, lineErrorKey, type Catalog, type FieldErrors, type LineDraft,
} from '@/ui/forms/recipeForm';
import { useLocale, useFormatters } from '@/ui/i18n';

interface LineRowProps {
  line: LineDraft;
  /** 1-based position, for screen readers ("Line 2"). */
  position: number;
  ingredients: readonly Ingredient[];
  /** Preps that may be chosen (the prep being edited is not among them). */
  preps: readonly Prep[];
  catalog: Catalog;
  errors: FieldErrors;
  /** null while the line is not valid yet. */
  cost: LineCost | null;
  onChange: (next: LineDraft) => void;
  onRemove: () => void;
}

export function LineRow({ line, position, ingredients, preps, catalog, errors, cost, onChange, onRemove }: LineRowProps) {
  const { t, locale } = useLocale();
  const f = useFormatters();
  const base = baseUnitOfRef(line.ref, catalog);
  const units = base === null ? unitsFor('g') : unitsFor(base);

  function chooseRef(ref: string) {
    const nextBase = baseUnitOfRef(ref, catalog);
    let unit: EnteredUnit | undefined;
    if (ref.startsWith('ingredient:')) {
      const ingredient = ingredients.find(entry => `ingredient:${entry.id}` === ref);
      if (ingredient) {
        const pack = ingredient.prices.at(-1);
        unit = pack ? quantityToInput(pack.packSizeMilli, ingredient.unit, locale).unit : ingredient.unit;
      }
    } else if (ref.startsWith('prep:')) {
      const prep = preps.find(entry => `prep:${entry.id}` === ref);
      if (prep) unit = quantityToInput(prep.outputMilli, prep.outputUnit, locale).unit;
    }
    onChange({ ...line, ref, unit: unit ?? (nextBase === null ? line.unit : unitsFor(nextBase)[0] ?? line.unit), stored: null });
  }

  const parsedQuantity = parseQuantityField(line.qty, line.unit, '');
  const cautionLimit = base === 'pc' ? 1_000_000 : 10_000_000;
  const largeQuantity = parsedQuantity.ok && parsedQuantity.value.milli > cautionLimit
    ? quantityToInput(parsedQuantity.value.milli, parsedQuantity.value.unit, locale)
    : null;

  return (
    <li data-line={line.id}>
      <div role="group" aria-label={t('recipe.linePosition', { position })} className="grid gap-3 border-y border-line py-4 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)] sm:items-start">
        <FormField label={t('recipe.chooseItem')} error={errors[lineErrorKey(line, 'ref')]} className="sm:col-span-1">
          {(control) => (
            <Select {...control} value={line.ref} onChange={(event) => chooseRef(event.target.value)}>
              <option value="">{t('recipe.choose')}</option>
              <optgroup label={t('recipe.ingredientsGroup')}>
                {ingredients.map((entry) => (
                  <option key={entry.id} value={`ingredient:${entry.id}`}>{entry.name} · {localizedUnit(entry.unit, locale)}</option>
                ))}
              </optgroup>
              {preps.length > 0 ? (
                <optgroup label={t('recipe.prepsGroup')}>
                  {preps.map((entry) => (
                  <option key={entry.id} value={`prep:${entry.id}`}>{entry.name} · {localizedUnit(entry.outputUnit, locale)}</option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          )}
        </FormField>

        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-start gap-2">
          <QuantityField
            label={t('recipe.netQuantity')}
            unit={localizedUnit(line.unit, locale)}
            error={errors[lineErrorKey(line, 'qty')]}
            autoComplete="off"
            value={line.qty}
            onValueChange={(qty) => onChange({ ...line, qty })}
            placeholder="150"
          />
          {largeQuantity && <p className="col-span-2 text-sm text-amber-800 dark:text-amber-300">{t('local.quantityLargeWarning', { amount: largeQuantity.text, unit: localizedUnit(largeQuantity.unit, locale) })}</p>}
          <FormField label={t('recipe.unit')}>
            {(control) => (
              <Select
                {...control}
                value={line.unit}
                disabled={units.length < 2}
                onChange={(event) => onChange({ ...line, unit: event.target.value as LineDraft['unit'] })}
              >
                {units.map((unit) => <option key={unit} value={unit}>{localizedUnit(unit, locale)}</option>)}
              </Select>
            )}
          </FormField>
        </div>

        <FormField label={t('recipe.yield')} error={errors[lineErrorKey(line, 'yield')]} hint={t('recipe.yieldHint')}>
          {(control) => (
            <Input
              {...control}
              inputMode="decimal"
              autoComplete="off"
              value={line.yieldPct}
              onChange={(event) => onChange({ ...line, yieldPct: event.target.value })}
            />
          )}
        </FormField>

        <div className="flex items-end justify-between gap-2 sm:flex-col sm:items-stretch">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm leading-none font-medium">{t('recipe.lineCost')}</span>
            <span className="flex h-9 items-center text-sm tabular-nums">{cost === null ? '—' : cost.error ? t('recipe.cannotCalculate') : cost.costMicro === null ? t('common.costUnknown') : f.microMoney(cost.costMicro)}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={t('recipe.removeLinePosition', { position })}>
            <Trash2Icon aria-hidden="true" /> {t('recipe.removeLine')}
          </Button>
        </div>
      </div>
    </li>
  );
}
