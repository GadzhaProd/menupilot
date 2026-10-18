import { useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, RefreshCwIcon, SaveIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { packUnitPriceDisplay } from '@/ui/domain/calc';
import {
  dishLines, ingredientInfos, type IngredientInfo, type LineInfo, type Run, type ScenarioDelta,
} from '@/ui/domain/simulator';
import type { SimulateResult } from '@/ui/domain/types';
import { formatDate } from '@/ui/ingredients/format';
import { formatQuantity, parseMoneyField, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';
import { useFocusFirstInvalid } from '@/ui/hooks/useFocusFirstInvalid';
import { Delta, euro, signedEuro } from './format';
import {
  countChanges, NAME_MAX_LENGTH, priceKey, qtyKey, validateName, type FieldsDraft,
} from './scenarioForm';
import { slotLetter, type ScenarioDraft } from './scenarios';

interface ScenarioCardProps {
  draft: ScenarioDraft;
  /** Position in the list: 0 is "A". */
  index: number;
  run: Run;
  delta: ScenarioDelta | null;
  /** Baseline today, to show what the fields start from. */
  baseline: SimulateResult | null;
  /** The shared sales estimate this scenario uses unless it has its own. */
  sharedVolume: number | undefined;
  stale: boolean;
  dirty: boolean;
  /** Why the last save or baseline update failed; the typed values are still here. */
  problem: string | null;
  /** Goes up when a save was refused, so the first wrong field gets focus. */
  attempt: number;
  onRename: (name: string) => void;
  onFields: (fields: FieldsDraft) => void;
  onSave: () => void;
  onDelete: (event: { currentTarget: HTMLElement }) => void;
  onUpdateBaseline: () => void;
  onDismissNotes: () => void;
}

function Disclosure({ title, changed, hasError, defaultOpen, children }: {
  title: string; changed: number; hasError: boolean; defaultOpen: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open || hasError}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-lg border bg-background"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {changed > 0 ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{changed} changed</span> : null}
          <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t p-3">{children}</div>
    </details>
  );
}

function IngredientPriceRow({ info, text, error, onChange }: {
  info: IngredientInfo; text: string; error: string | undefined; onChange: (text: string) => void;
}) {
  const { price, earlier } = info;
  const typed = text.trim() === '' || price === null ? null : parseMoneyField(text, '');
  return (
    <li>
      <div role="group" aria-label={`Price of ${info.name}`} className="space-y-1.5 rounded-md border p-2.5">
        <div>
          <p className="text-sm font-medium">{info.name}</p>
          <p className="text-xs text-muted-foreground">Used in: {info.usedIn.join(', ')}</p>
        </div>
        {price === null ? (
          <p className="text-xs text-muted-foreground">No price yet, so it cannot be changed here. Add one on the Ingredients screen.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Now: {euro(price.packPriceCents)} per {formatQuantity(price.packSizeMilli, info.unit)} pack
              {' '}(<strong className="font-medium text-foreground">{packUnitPriceDisplay(price.packPriceCents, price.packSizeMilli, info.unit)}</strong>)
              {earlier ? <> · Before: {packUnitPriceDisplay(earlier.packPriceCents, earlier.packSizeMilli, info.unit)} ({formatDate(earlier.recordedAt)})</> : null}
            </p>
            <FormField
              label={<span>New pack price (€, excl. VAT)<span className="sr-only"> of {info.name}</span></span>}
              hint="Supplier price excl. VAT, as on the invoice"
              error={error}
            >
              {(control) => (
                <Input
                  {...control}
                  inputMode="decimal"
                  autoComplete="off"
                  value={text}
                  placeholder={euro(price.packPriceCents).slice(1)}
                  onChange={(event) => onChange(event.target.value)}
                />
              )}
            </FormField>
            {typed?.ok ? (
              <p aria-live="polite" className="text-xs">
                That is <strong>{packUnitPriceDisplay(typed.value, price.packSizeMilli, info.unit)}</strong> excl. VAT.
              </p>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function LineRow({ line, draft, error, onChange }: {
  line: LineInfo; draft: { text: string; unit: EnteredUnit } | undefined; error: string | undefined;
  onChange: (next: { text: string; unit: EnteredUnit }) => void;
}) {
  if (line.refKind === 'prep') {
    return (
      <li className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
        <span className="text-sm font-medium text-foreground">{line.name}</span> (prep) · {formatQuantity(line.netQtyMilli, line.unit)}
        <br />Not editable here: a prep’s own quantities are changed in the recipe. Change the prices of the ingredients inside it above.
      </li>
    );
  }
  const units = unitsFor(line.unit);
  const value = draft ?? { text: '', unit: units[0] ?? 'g' };
  return (
    <li>
      <div role="group" aria-label={`Quantity of ${line.name}`} className="space-y-1.5 rounded-md border p-2.5">
        <p className="text-sm font-medium">{line.name}</p>
        <p className="text-xs text-muted-foreground">In Baseline: {formatQuantity(line.netQtyMilli, line.unit)} net per portion batch</p>
        <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-start gap-2">
          <FormField label={<span>New net quantity<span className="sr-only"> of {line.name}</span></span>} error={error}>
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                autoComplete="off"
                value={value.text}
                placeholder="unchanged"
                onChange={(event) => onChange({ ...value, text: event.target.value })}
              />
            )}
          </FormField>
          <FormField label={<span>Unit<span className="sr-only"> of {line.name}</span></span>}>
            {(control) => (
              <Select
                {...control}
                value={value.unit}
                disabled={units.length < 2}
                onChange={(event) => onChange({ ...value, unit: event.target.value as EnteredUnit })}
              >
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </Select>
            )}
          </FormField>
        </div>
      </div>
    </li>
  );
}

/** One scenario: its name, the changes typed into it, and what they do right now. */
export function ScenarioCard({
  draft, index, run, delta, baseline, sharedVolume, stale, dirty, problem, attempt,
  onRename, onFields, onSave, onDelete, onUpdateBaseline, onDismissNotes,
}: ScenarioCardProps) {
  const root = useRef<HTMLElement>(null);
  useFocusFirstInvalid(root, attempt);
  const { fields, errors } = draft;
  const infos = ingredientInfos(draft.baseline);
  const lines = dishLines(draft.baseline);
  const changes = countChanges(draft.applied);
  const nameError = validateName(draft.name);
  const hasPriceError = infos.some((info) => errors[priceKey(info.id)] !== undefined);
  const hasQtyError = lines.some((line) => errors[qtyKey(line.id)] !== undefined);
  const letter = slotLetter(index);
  const hasErrors = Object.keys(errors).length > 0 || nameError !== null;

  return (
    <section ref={root} aria-label={`Scenario ${letter}`} data-scenario={draft.key}>
      <Card className="gap-4">
        <CardHeader className="gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{letter}</span>
            <FormField label={<span className="sr-only">Scenario name</span>} error={nameError ?? undefined} className="flex-1">
              {(control) => (
                <Input
                  {...control}
                  value={draft.name}
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="off"
                  className="font-semibold"
                  onChange={(event) => onRename(event.target.value)}
                />
              )}
            </FormField>
          </div>
          {run.ok ? (
            <dl className="grid grid-cols-2 gap-2 rounded-lg bg-secondary/50 p-3" aria-label={`Result of scenario ${letter}`}>
              <div>
                <dt className="text-xs text-muted-foreground">Contribution per portion</dt>
                <dd className="text-lg font-semibold tabular-nums">{euro(run.result.contributionCents)}</dd>
                <dd>{delta && !stale ? <Delta value={delta.contributionDeltaCents} format={signedEuro} better="higher" /> : null}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Monthly contribution (your estimate)</dt>
                <dd className="text-lg font-semibold tabular-nums">{euro(run.result.monthlyContributionCents)}</dd>
                <dd>{delta && !stale ? <Delta value={delta.monthlyContributionDeltaCents} format={signedEuro} better="higher" /> : null}</dd>
              </div>
            </dl>
          ) : (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">This scenario cannot be calculated: {run.error}</p>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {stale ? (
            <Alert variant="warning">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertDescription>
                <p className="font-medium">Baseline changed since this scenario was saved</p>
                <p>A price or recipe is different now, so these numbers use older data. Update the baseline to calculate on today’s data; your changes are kept where they still apply.</p>
              </AlertDescription>
              <AlertAction>
                <Button size="sm" onClick={onUpdateBaseline}><RefreshCwIcon aria-hidden="true" /> Update baseline</Button>
              </AlertAction>
            </Alert>
          ) : null}
          {draft.notes.length > 0 ? (
            <Alert>
              <AlertDescription>
                <p className="font-medium">Baseline updated. Some changes no longer apply and were removed:</p>
                <ul className="list-disc pl-5">
                  {draft.notes.map((note) => <li key={note}>{note}</li>)}
                </ul>
              </AlertDescription>
              <AlertAction><Button size="sm" variant="outline" onClick={onDismissNotes}>OK</Button></AlertAction>
            </Alert>
          ) : null}

          <FormField
            label="Menu price (incl. VAT, €)"
            hint={baseline ? `Baseline: ${euro(baseline.menuPriceInclVatCents)} incl. VAT. Leave empty to keep it.` : undefined}
            error={errors.menuPrice}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                autoComplete="off"
                value={fields.menuPrice}
                placeholder={baseline ? euro(baseline.menuPriceInclVatCents).slice(1) : undefined}
                onChange={(event) => onFields({ ...fields, menuPrice: event.target.value })}
              />
            )}
          </FormField>

          <FormField
            label="Own sales per month (optional)"
            hint={sharedVolume === undefined ? 'Empty: no monthly figure.' : `Empty: uses the shared estimate (${sharedVolume}).`}
            error={errors.volume}
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                autoComplete="off"
                value={fields.volume}
                onChange={(event) => onFields({ ...fields, volume: event.target.value })}
              />
            )}
          </FormField>

          <Disclosure title="Ingredient prices" changed={changes.ingredients} hasError={hasPriceError} defaultOpen={changes.ingredients > 0}>
            <p className="text-xs text-muted-foreground">
              A new pack price counts everywhere the ingredient is used, also inside preps. The real price on the Ingredients screen is never changed.
            </p>
            <ul className="space-y-2">
              {infos.map((info) => (
                <IngredientPriceRow
                  key={info.id}
                  info={info}
                  text={fields.prices[info.id] ?? ''}
                  error={errors[priceKey(info.id)]}
                  onChange={(text) => onFields({ ...fields, prices: { ...fields.prices, [info.id]: text } })}
                />
              ))}
            </ul>
          </Disclosure>

          <Disclosure title="Quantities in the dish" changed={changes.quantities} hasError={hasQtyError} defaultOpen={changes.quantities > 0}>
            <p className="text-xs text-muted-foreground">
              Only the dish’s own lines can be changed. Changing a quantity may affect quality, food safety or allergen information: check before changing a recipe.
            </p>
            <ul className="space-y-2">
              {lines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  draft={fields.qty[line.id]}
                  error={errors[qtyKey(line.id)]}
                  onChange={(next) => onFields({ ...fields, qty: { ...fields.qty, [line.id]: next } })}
                />
              ))}
            </ul>
          </Disclosure>
        </CardContent>

        <CardFooter className="flex flex-wrap items-center gap-2">
          <Button onClick={onSave} disabled={!dirty && draft.id !== null}>
            <SaveIcon aria-hidden="true" /> {draft.id === null ? 'Save scenario' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onDelete}>
            <Trash2Icon aria-hidden="true" /> {draft.id === null ? 'Remove' : 'Delete'}
          </Button>
          <p aria-live="polite" className="basis-full text-xs text-muted-foreground sm:basis-auto">
            {draft.id === null ? 'Not saved yet.' : dirty ? 'Unsaved changes.' : 'Saved.'}
            {hasErrors ? ' Fix the marked fields to save; results show your last valid values.' : ''}
          </p>
          {problem !== null ? (
            <p role="alert" className="basis-full rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{problem}</p>
          ) : null}
        </CardFooter>
      </Card>
    </section>
  );
}
