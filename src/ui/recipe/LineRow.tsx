import { Trash2Icon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatEURFromMicro } from '@/ui/domain/calc';
import type { LineCost } from '@/ui/domain/recipeCosts';
import type { Ingredient, Prep } from '@/ui/domain/types';
import { unitsFor } from '@/ui/forms/numbers';
import {
  baseUnitOfRef, lineErrorKey, type Catalog, type FieldErrors, type LineDraft,
} from '@/ui/forms/recipeForm';

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

function costText(cost: LineCost | null) {
  if (cost === null) return <span className="text-muted-foreground">—</span>;
  if (cost.error) return <span className="text-destructive" title={cost.error}>cannot calculate</span>;
  if (cost.costMicro === null) return <span className="text-muted-foreground">cost unknown</span>;
  return formatEURFromMicro(cost.costMicro);
}

export function LineRow({ line, position, ingredients, preps, catalog, errors, cost, onChange, onRemove }: LineRowProps) {
  const base = baseUnitOfRef(line.ref, catalog);
  const units = base === null ? unitsFor('g') : unitsFor(base);

  function chooseRef(ref: string) {
    // The unit follows what was chosen: grams for beef, millilitres for milk, pieces for buns.
    const nextBase = baseUnitOfRef(ref, catalog);
    onChange({ ...line, ref, unit: nextBase === null ? line.unit : unitsFor(nextBase)[0] ?? line.unit, stored: null });
  }

  return (
    <li data-line={line.id}>
      <div role="group" aria-label={`Line ${position}`} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,1fr)] sm:items-start">
        <FormField label="Ingredient or prep" error={errors[lineErrorKey(line, 'ref')]} className="sm:col-span-1">
          {(control) => (
            <Select {...control} value={line.ref} onChange={(event) => chooseRef(event.target.value)}>
              <option value="">Choose…</option>
              <optgroup label="Ingredients">
                {ingredients.map((entry) => (
                  <option key={entry.id} value={`ingredient:${entry.id}`}>{entry.name} · {entry.unit}</option>
                ))}
              </optgroup>
              {preps.length > 0 ? (
                <optgroup label="Preps">
                  {preps.map((entry) => (
                    <option key={entry.id} value={`prep:${entry.id}`}>{entry.name} · {entry.outputUnit}</option>
                  ))}
                </optgroup>
              ) : null}
            </Select>
          )}
        </FormField>

        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-start gap-2">
          <FormField label="Net quantity" error={errors[lineErrorKey(line, 'qty')]}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                autoComplete="off"
                value={line.qty}
                onChange={(event) => onChange({ ...line, qty: event.target.value })}
                placeholder="150"
              />
            )}
          </FormField>
          <FormField label="Unit">
            {(control) => (
              <Select
                {...control}
                value={line.unit}
                disabled={units.length < 2}
                onChange={(event) => onChange({ ...line, unit: event.target.value as LineDraft['unit'] })}
              >
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </Select>
            )}
          </FormField>
        </div>

        <FormField label="Yield %" error={errors[lineErrorKey(line, 'yield')]} hint="Usable part. 100 = no loss.">
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
            <span className="text-sm leading-none font-medium">Line cost (excl. VAT)</span>
            <span className="flex h-9 items-center text-sm">{costText(cost)}</span>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove line ${position}`}>
            <Trash2Icon aria-hidden="true" /> Remove
          </Button>
        </div>
      </div>
    </li>
  );
}
