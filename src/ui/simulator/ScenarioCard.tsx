import { useCommands } from '@/ui/data/DataProvider';
import { CommandButton } from '@/ui/data/CommandButton';
import { MoneyField, QuantityField } from '@/components/numeric-field';
import { useLocale, useFormatters } from '@/ui/i18n';
import { useRef, useState, type ReactNode } from 'react';
import { ChevronDownIcon, RefreshCwIcon, SaveIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  dishLines, ingredientInfos, type IngredientInfo, type LineInfo, type Run, type ScenarioDelta,
} from '@/ui/domain/simulator';
import type { SimulateResult } from '@/ui/domain/types';
import { centsToInput, formatQuantity, formatQuantityLocale, localizedUnit, parseMoneyField, parseQuantityField, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';
import { useFocusFirstInvalid } from '@/ui/hooks/useFocusFirstInvalid';
import { Delta } from './format';
import {
  countChanges, NAME_MAX_LENGTH, priceKey, qtyKey, validateName, type FieldsDraft, type FormErrorKey,
} from './scenarioForm';
import { slotLetter, type ScenarioDraft } from './scenarios';

interface ScenarioCardProps {
  draft: ScenarioDraft;
  /** Position in the list: 0 is "A". */
  index: number;
  run: Run;
  delta: ScenarioDelta | null;
  /** This scenario's own baseline (older than today's when it is out of date): what its fields start from. */
  ownBaseline: SimulateResult | null;
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
  const { t } = useLocale(); const f = useFormatters();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      open={open || hasError}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-lg border bg-background"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 min-h-12 rounded-lg px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {changed > 0 ? <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs text-primary">{t('simulator.changed', { count: f.integer(changed) })}</span> : null}
          <ChevronDownIcon aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 border-t p-3">{children}</div>
    </details>
  );
}

function IngredientPriceRow({ info, text, error, onChange }: {
  info: IngredientInfo; text: string; error: FormErrorKey | undefined; onChange: (text: string) => void;
}) {
  const { t } = useLocale(); const f = useFormatters();
  const euro = (v: number | bigint) => f.money(v);
  const { price, earlier } = info;
  const typed = text.trim() === '' || price === null ? null : parseMoneyField(text, '');
  return (
    <li>
      <div role="group" aria-label={t('simulator.priceOf', { name: info.name })} className="space-y-1.5 rounded-md border p-2.5">
        <div>
          <p className="text-sm font-medium">{info.name}</p>
          <p className="text-xs text-muted-foreground">{t('simulator.usedIn', { names: info.usedIn.join(', ') })}</p>
        </div>
        {price === null ? (
          <p className="text-xs text-muted-foreground">{t('simulator.noIngredientPrice')}</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('simulator.nowPack', { price: euro(price.packPriceCents), size: formatQuantity(price.packSizeMilli, info.unit) })}
              {' '}(<strong className="font-medium text-foreground">{f.packPrice(price.packPriceCents, price.packSizeMilli, info.unit)}</strong>)
              {earlier ? <> · {t('simulator.earlier', { price: f.packPrice(earlier.packPriceCents, earlier.packSizeMilli, info.unit), date: f.date(earlier.recordedAt) })}</> : null} {t('common.exclVat')}
            </p>
            <MoneyField vat="excl" supplier
              label={t('simulator.packInput', { name: info.name })}
              error={error ? t(error) : undefined} autoComplete="off"
              value={text} placeholder={centsToInput(price.packPriceCents)} onValueChange={onChange}
            />
            {typed?.ok ? (
              <p aria-live="polite" className="text-xs">
                {t('simulator.unitPrice', { price: f.packPrice(typed.value, price.packSizeMilli, info.unit) })}
              </p>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

function LineRow({ line, draft, error, onChange }: {
  line: LineInfo; draft: { text: string; unit: EnteredUnit } | undefined; error: FormErrorKey | undefined;
  onChange: (next: { text: string; unit: EnteredUnit }) => void;
}) {
  const { t, locale } = useLocale();
  const [unitCleared, setUnitCleared] = useState(false);
  const units = unitsFor(line.unit);
  const value = draft ?? { text: '', unit: units[0] ?? 'g' };
  const enteredUnitLabel = localizedUnit(value.unit, locale);
  function changeUnit(nextUnit: EnteredUnit) {
    if (value.text.trim() === '') {
      setUnitCleared(false);
      onChange({ ...value, unit: nextUnit });
      return;
    }
    const parsed = parseQuantityField(value.text, value.unit, '');
    const converted = parsed.ok ? quantityInputInUnit(parsed.value.milli, nextUnit) : null;
    if (converted === null) {
      onChange({ text: '', unit: nextUnit });
      setUnitCleared(true);
      return;
    }
    setUnitCleared(false);
    onChange({ text: converted, unit: nextUnit });
  }
  return (
    <li>
      <div role="group" aria-label={t('simulator.quantityOf', { name: line.name })} className="space-y-1.5 rounded-md border p-2.5">
        <p className="text-sm font-medium">{line.name}</p>
        <p className="text-xs text-muted-foreground">{t('simulator.inBaseline', { quantity: formatQuantityLocale(line.netQtyMilli, line.unit, locale) })}</p>
        <div className="grid grid-cols-1 items-start gap-2">
          <QuantityField label={t('simulator.newQuantity')} unit={enteredUnitLabel}
            aria-label={t('simulator.newQuantityOf', { name: line.name, unit: enteredUnitLabel })}
            error={error ? t(error) : undefined} autoComplete="off" value={value.text}
            placeholder={t('simulator.unchanged')} onValueChange={text => { setUnitCleared(false); onChange({ ...value, text }); }}
          />
          <FormField label={t('simulator.unit')}>
            {(control) => (
              <Select
                {...control}
                aria-label={t('simulator.unitOf', { name: line.name })}
                value={value.unit}
                disabled={units.length < 2}
                onChange={(event) => changeUnit(event.target.value as EnteredUnit)}
              >
                {units.map((unit) => <option key={unit} value={unit}>{localizedUnit(unit, locale)}</option>)}
              </Select>
            )}
          </FormField>
          {unitCleared ? <p role="status" className="text-xs text-muted-foreground">{t('simulator.unitChangeClearedHint')}</p> : null}
        </div>
      </div>
    </li>
  );
}

/** Reprint a parsed base-unit milli quantity in a selected unit without floating point. */
function quantityInputInUnit(milli: number, unit: EnteredUnit): string | null {
  const compact = unit === 'kg' || unit === 'l';
  const divisor = compact ? 1_000_000n : 1_000n;
  const quantum = compact ? 1_000n : 10n;
  const value = BigInt(milli);
  if (value % quantum !== 0n) return null;
  const whole = value / divisor;
  const fraction = ((value % divisor) / quantum).toString().padStart(compact ? 3 : 2, '0').replace(/0+$/, '');
  return fraction === '' ? whole.toString() : `${whole}.${fraction}`;
}

/** One scenario: its name, the changes typed into it, and what they do right now. */
export function ScenarioCard({
  draft, index, run, delta, ownBaseline, sharedVolume, stale, dirty, problem, attempt,
  onRename, onFields, onSave, onDelete, onUpdateBaseline, onDismissNotes,
}: ScenarioCardProps) {
  const { commandStatus } = useCommands();
  const { t, plural } = useLocale(); const f = useFormatters();
  const euro = (v: number | bigint | null) => v === null ? '—' : f.money(v);
  const signedEuro = (v: bigint) => `${v > 0n ? '+' : ''}${f.money(v)}`;
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
    <section ref={root} aria-label={t('simulator.scenario', { letter })} data-scenario={draft.key}>
      <fieldset disabled={commandStatus === 'saving'} className="contents"><Card className="gap-4">
        <CardHeader className="gap-3">
          <div className="flex items-start gap-3">
            <FormField label={t('simulator.name')} error={nameError ? t(nameError) : undefined} className="flex-1">
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

        </CardHeader>

        <CardContent className="space-y-3">
          {stale ? (
            <Alert variant="warning">
              <TriangleAlertIcon aria-hidden="true" />
              <AlertDescription>
                <p className="font-medium">{t(draft.id === null ? 'simulator.staleMade' : 'simulator.staleSaved')}</p>
                <p>{t('simulator.staleDescription')}</p>
              </AlertDescription>
              <AlertAction>
                <Button size="sm" onClick={onUpdateBaseline}><RefreshCwIcon aria-hidden="true" /> {t('simulator.update')}</Button>
              </AlertAction>
            </Alert>
          ) : null}
          {draft.notes.length > 0 ? (
            <Alert>
              <AlertDescription>
                <p className="font-medium">{t('simulator.updated')}</p>
                <ul className="list-disc pl-5">
                  {draft.notes.map((note, i) => <li key={i}>{t(note.key, note.params)}</li>)}
                </ul>
              </AlertDescription>
              <AlertAction><Button size="sm" variant="outline" onClick={onDismissNotes}>{t('simulator.ok')}</Button></AlertAction>
            </Alert>
          ) : null}

          <MoneyField vat="incl" label={t('simulator.menuInput')}
            hint={ownBaseline ? t('simulator.menuHint', { price: euro(ownBaseline.menuPriceInclVatCents) }) : undefined}
            error={errors.menuPrice ? t(errors.menuPrice) : undefined} autoComplete="off"
            value={fields.menuPrice} placeholder={ownBaseline ? centsToInput(ownBaseline.menuPriceInclVatCents) : undefined}
            onValueChange={menuPrice => onFields({ ...fields, menuPrice })}
          />

          <FormField
            label={t('simulator.ownVolume')}
            hint={sharedVolume === undefined ? t('simulator.emptyVolume') : t('simulator.usesShared', { count: f.integer(sharedVolume) })}
            error={errors.volume ? t(errors.volume) : undefined}
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

          {run.ok ? (
            <dl className="grid gap-3 border-y border-line py-4" aria-label={t('simulator.result', { letter })}>
              <div>
                <dt className="text-xs text-muted-foreground">{t('simulator.contribution')} · {t('simulator.otherCosts')}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{euro(run.result.contributionCents)}</dd>
                <dd>{delta && !stale ? <Delta value={delta.contributionDeltaCents} format={signedEuro} better="higher" /> : null}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('simulator.monthlyOwn')}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{euro(run.result.monthlyContributionCents)}</dd>
                <dd>{delta && !stale ? <Delta value={delta.monthlyContributionDeltaCents} format={signedEuro} better="higher" /> : null}</dd>
              </div>
              <div className="min-w-0"><dd className="text-xs text-muted-foreground">
                {run.result.monthlyVolume === null
                  ? t('simulator.noEstimate')
                  : plural(draft.applied.monthlyVolume === undefined ? 'simulator.calculatedShared' : 'simulator.calculatedOwn', run.result.monthlyVolume, { count: f.integer(run.result.monthlyVolume) })}
              </dd></div>
            </dl>
          ) : (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{t('simulator.failedScenario')}</p>
          )}

          <Disclosure title={t('simulator.ingredients')} changed={changes.ingredients} hasError={hasPriceError} defaultOpen={changes.ingredients > 0}>
            <p className="text-xs text-muted-foreground">
              {t('simulator.priceHint')}
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

          <Disclosure title={t('simulator.quantities')} changed={changes.quantities} hasError={hasQtyError} defaultOpen={changes.quantities > 0}>
            <p className="text-xs text-muted-foreground">
              {t('simulator.quantityHint')}
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
          <CommandButton onClick={onSave} disabled={!dirty && draft.id !== null}>
            <SaveIcon aria-hidden="true" /> {t(draft.id === null ? 'simulator.save' : 'simulator.saveChanges')}
          </CommandButton>
          <Button variant="ghost" onClick={onDelete}>
            <Trash2Icon aria-hidden="true" /> {t(draft.id === null ? 'simulator.remove' : 'simulator.delete')}
          </Button>
          <p aria-live="polite" className="basis-full text-xs text-muted-foreground sm:basis-auto">
            {t(draft.id === null ? 'simulator.notSaved' : dirty ? 'simulator.unsaved' : 'simulator.saved')}
            {hasErrors && <> {t('simulator.fixFields')}</>}
          </p>
          {problem !== null ? (
            <p role="alert" className="basis-full rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{problem}</p>
          ) : null}
        </CardFooter>
      </Card></fieldset>
    </section>
  );
}
