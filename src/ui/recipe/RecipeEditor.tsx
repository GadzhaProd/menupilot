import { CommandButton } from '@/ui/data/CommandButton';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { PlusIcon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { MoneyField, QuantityField } from '@/components/numeric-field';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import { lineCost, recipeCosts, withRecipe } from '@/ui/domain/recipeCosts';
import type { Prep, Recipe } from '@/ui/domain/types';
import { ALL_UNITS, localizedUnit, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';
import {
  buildRecipe, draftFromRecipe, blankDraft, emptyLine, parseLine, recipesUsing, vatOptions,
  type LineDraft, type RecipeDraft, type RecipeValidationCopy,
} from '@/ui/forms/recipeForm';
import { HelpLink } from '@/ui/help/HelpLink';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useFocusFirstInvalid } from '@/ui/hooks/useFocusFirstInvalid';
import { localizedRecipeSaveError } from '@/ui/forms/saveError';
import { hrefFor } from '@/ui/router/routes';
import { CostSummary } from './CostSummary';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { LineRow } from './LineRow';
import { useLocale } from '@/ui/i18n';
import { Surface } from '@/components/ui/surface';
import { InlineStatus } from '@/components/ui/inline-status';
import { useRecipeDrafts } from './RecipeDraftProvider';
import { mergeDraft, type DraftConflict } from './mergeDraft';
import { isSafetyError } from '@/ui/data/safetyErrors';

/** Stands in for the id of a recipe that is not saved yet, so its cost can still be calculated. */
const UNSAVED_ID = 'unsaved';

interface RecipeEditorProps {
  /** The saved recipe, or null to create a new one of `kind`. */
  recipe: Recipe | null;
  kind: 'dish' | 'prep';
}

export function RecipeEditor({ recipe, kind }: RecipeEditorProps) {
  const { t, locale } = useLocale();
  const document = useDocument();
  const { execute, commandStatus } = useCommands();
  const draftCache = useRecipeDrafts();
  const draftKey = recipe?.id ?? `new:${kind}`;
  const source = recipe ?? document;
  const sourceSnapshot = useMemo(() => JSON.stringify(source) ?? '', [source]);
  const sourceSnapshotRef = useRef(sourceSnapshot);
  const sourceChanged = sourceSnapshotRef.current !== sourceSnapshot;
  const [initial] = useState(() => recipe ? draftFromRecipe(recipe, document) : blankDraft(kind, document.settings.defaultVatRateBp));
  const [starting] = useState(() => {
    const cached = draftCache.read(draftKey);
    return cached ? mergeDraft(cached.baseline, cached.draft, recipe ? initial : { ...initial, lines: cached.baseline.lines }, cached.conflicts)
      : { draft: initial, baseline: initial, conflicts: [] };
  });
  const [baseline, setBaseline] = useState<RecipeDraft>(starting.baseline);
  const [draft, setDraft] = useState<RecipeDraft>(starting.draft);
  const [conflicts, setConflicts] = useState<DraftConflict[]>(starting.conflicts);
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const addLineRef = useRef<HTMLButtonElement>(null);
  const dialog = useDialogState<'delete'>();
  useFocusFirstInvalid(formRef, attempt);

  const id = recipe?.id ?? UNSAVED_ID;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    if (!sourceChanged) return;
    sourceSnapshotRef.current = sourceSnapshot;
    const fresh = recipe ? draftFromRecipe(recipe, document) : { ...blankDraft(kind, document.settings.defaultVatRateBp), lines: baseline.lines };
    const merged = mergeDraft(baseline, draft, fresh, conflicts);
    setDraft(merged.draft);
    setConflicts(merged.conflicts);
    setBaseline(fresh);
    setAttempt(0);
    setSaveError(null);
  }, [sourceChanged, sourceSnapshot, draftKey, recipe, document, kind, baseline, draft, conflicts]);

  useEffect(() => {
    if (sourceChanged) return;
    if (dirty || conflicts.length) draftCache.write(draftKey, { draft, baseline, conflicts });
    else draftCache.clear(draftKey);
  }, [sourceChanged, dirty, draft, draftKey, sourceSnapshot, draftCache, baseline, conflicts]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Everything below is derived from the draft while rendering: nothing calculated is stored.
  const validationCopy = useMemo<RecipeValidationCopy>(() => ({
    nameEmpty: t('recipe.error.name'), nameLong: t('recipe.error.nameLong'), chooseRef: t('recipe.error.ref'), selfRef: t('recipe.error.self'),
    wrongUnit: (unit, units) => t('recipe.error.unit', { unit: localizedUnit(unit, locale), units: units.map((entry) => localizedUnit(entry, locale)).join(` ${t('common.or')} `) }), quantity: t('recipe.error.quantity'), yield: t('recipe.error.yield'), price: t('recipe.error.menuPrice'),
    portions: t('recipe.error.portions'), vat: t('recipe.error.vat'), volume: t('recipe.error.volume'), output: t('recipe.error.output'),
  }), [t, locale]);
  const built = useMemo(() => buildRecipe(draft, id, document, validationCopy), [draft, id, document, validationCopy]);
  const lineViews = useMemo(() => draft.lines.map((line) => {
    const parsed = parseLine(line, draft.kind === 'prep' ? id : null, document);
    return { parsed, cost: parsed.ok ? lineCost(parsed.line, document) : null };
  }), [draft.lines, draft.kind, id, document]);
  const costs = useMemo(() => {
    if (!built.ok) return null;
    const candidate = built.recipe as Recipe;
    return recipeCosts(candidate, withRecipe(document, candidate));
  }, [built, document]);
  const errors = attempt > 0 && !built.ok ? built.errors : {};

  const ingredients = useMemo(
    () => [...document.ingredients].sort((a, b) => a.name.localeCompare(b.name, locale)),
    [document.ingredients, locale],
  );
  const preps = useMemo(
    () => document.recipes
      .filter((entry): entry is Prep => entry.kind === 'prep' && entry.id !== recipe?.id)
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [document.recipes, recipe?.id, locale],
  );
  const missing = useMemo(() => lineViews.flatMap((view, index) => {
    const line = draft.lines[index];
    if (!view.parsed.ok || view.cost === null || view.cost.error || view.cost.costMicro !== null || !line) return [];
    const { kind: refKind, id: refId } = view.parsed.line.ref;
    const name = refKind === 'ingredient'
      ? document.ingredients.find((entry) => entry.id === refId)?.name
      : document.recipes.find((entry) => entry.id === refId)?.name;
    return [name ?? refId];
  }), [lineViews, draft.lines, document]);

  const usedBy = recipe?.kind === 'prep' ? recipesUsing(document, 'prep', recipe.id) : [];
  // A prep that dishes use keeps its kind of unit: their quantities were typed in it.
  const outputUnits: readonly EnteredUnit[] = recipe?.kind === 'prep' && usedBy.length > 0 ? unitsFor(recipe.outputUnit) : ALL_UNITS;

  function edit(patch: Partial<RecipeDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    setSaved(false);
  }
  function editLine(lineId: string, next: LineDraft) {
    setDraft((current) => ({ ...current, lines: current.lines.map((line) => (line.id === lineId ? next : line)) }));
    setSaved(false);
  }
  function addLine() {
    const line = emptyLine();
    edit({ lines: [...draft.lines, line] });
    // Wait for the new row to exist, then put the cursor in its first field.
    setTimeout(() => formRef.current?.querySelector<HTMLElement>(`[data-line="${line.id}"] select`)?.focus(), 0);
  }
  function removeLine(lineId: string) {
    edit({ lines: draft.lines.filter((line) => line.id !== lineId) });
    addLineRef.current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setAttempt((count) => count + 1);
    setSaved(false);
    if (conflicts.length) return;
    if (!built.ok) {
      setSaveError(null);
      return;
    }
    const { id: _unsaved, ...input } = built.recipe;
    const toSave = recipe ? { ...input, id: recipe.id } : input;
    const result = (await execute((store) => store.saveRecipe(toSave), { report: false }));
    if (!result.ok) {
      // The draft stays exactly as typed; the saved data is unchanged.
      setSaveError(isSafetyError(result.code) ? null : localizedRecipeSaveError(locale, t, result.code, result.error, result.details));
      return;
    }
    draftCache.clear(draftKey);
    setSaveError(null);
    if (!recipe) {
      window.location.hash = hrefFor({ name: 'recipe', id: result.value.id });
      return;
    }
    const stored = result.value.document.recipes.find((entry) => entry.id === recipe.id);
    if (stored) {
      const fresh = draftFromRecipe(stored, result.value.document);
      setDraft(fresh);
      setBaseline(fresh);
    }
    setAttempt(0);
    setSaved(true);
  }

  function discard() {
    setDraft(baseline);
    setConflicts([]);
    setAttempt(0);
    setSaveError(null);
    setSaved(false);
  }

  const fieldLabels: Record<DraftConflict['field'], string> = {
    kind: t('recipe.dish'), name: t('recipe.name'), menuPrice: t('recipe.menuPriceInput'),
    vatRateBp: t('recipe.vatRate'), portions: t('recipe.portions'), monthlyVolume: t('recipe.monthlyVolume'),
    output: t('recipe.oneBatch'), lines: t('recipe.ingredientsAndPreps'),
  };
  const showValue = (value: DraftConflict['local']) => typeof value === 'string' ? value : 'outputQty' in value ? `${value.outputQty} ${localizedUnit(value.outputUnit, locale)}` : value.map(line => {
    const refId = line.ref.slice(line.ref.indexOf(':') + 1);
    const item = [...document.ingredients, ...document.recipes].find(item => item.id === refId);
    return `${item?.name ?? t('recipe.error.ref')} · ${line.qty} ${localizedUnit(line.unit, locale)} · ${line.yieldPct}%`;
  }).join('\n');
  function resolve(conflict: DraftConflict, latest: boolean) {
    if (latest) setDraft(current => conflict.field === 'output' ? { ...current, ...conflict.latest } : { ...current, [conflict.field]: conflict.latest });
    setConflicts(current => current.filter(item => item.field !== conflict.field));
  }
  const heading = recipe?.name ?? t(kind === 'dish' ? 'recipe.newDish' : 'recipe.newPrep');

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <a href={hrefFor({ name: 'recipes' })} className="inline-flex min-h-12 items-center text-accent-foreground underline-offset-4 hover:bg-panel hover:underline">{t('recipe.all')}</a>
        <h1 id="page-title" className="text-4xl font-semibold">{heading}</h1>
        <p className="max-w-prose text-muted-foreground">{kind === 'dish' ? t('recipe.dishIntro') : t('recipe.prepIntro')}</p>
        <HelpLink section={kind === 'dish' ? 'dishes' : 'preps'} />
      </div>

      <form data-draft-kind={recipe ? "recipe" : undefined} data-draft-id={recipe?.id} ref={formRef} noValidate onSubmit={submit} className="space-y-6"><fieldset disabled={commandStatus === 'saving'} className="contents">
        <Surface aria-labelledby="recipe-details-title" className="space-y-4">
          <header className="space-y-1"><h2 id="recipe-details-title" className="text-xl font-semibold">{kind === 'dish' ? t('recipe.dish') : t('recipe.prep')}</h2><p className="text-muted-foreground">{t('recipe.vatNote')}</p></header>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('recipe.name')} error={errors.name} className="sm:col-span-2">
              {(control) => (
                <Input
                  {...control}
                  autoComplete="off"
                  value={draft.name}
                  onChange={(event) => edit({ name: event.target.value })}
                  placeholder={kind === 'dish' ? t('recipe.dishPlaceholder') : t('recipe.prepPlaceholder')}
                />
              )}
            </FormField>

            {kind === 'dish' ? (
              <>
                <MoneyField
                  vat="incl"
                  label={t('recipe.menuPriceInput')}
                  error={errors.menuPrice}
                  hint={t('recipe.guestPrice')}
                  autoComplete="off"
                  value={draft.menuPrice}
                  onValueChange={(menuPrice) => edit({ menuPrice })}
                  placeholder={t('recipe.priceExample')}
                />
                <FormField label={t('recipe.vatRate')} error={errors.vatRateBp} hint={t('recipe.vatHint')}>
                  {(control) => (
                    <Select {...control} value={draft.vatRateBp} onChange={(event) => edit({ vatRateBp: event.target.value })}>
                      {vatOptions(draft.vatRateBp, locale).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  )}
                </FormField>
                <FormField label={t('recipe.portions')} error={errors.portions} hint={t('recipe.portionsHint')}>
                  {(control) => (
                    <Input {...control} inputMode="numeric" autoComplete="off" value={draft.portions} onChange={(event) => edit({ portions: event.target.value })} />
                  )}
                </FormField>
                <FormField label={t('recipe.monthlyVolume')} error={errors.monthlyVolume} hint={t('recipe.monthlyVolumeHint')}>
                  {(control) => (
                    <Input {...control} inputMode="numeric" autoComplete="off" value={draft.monthlyVolume} onChange={(event) => edit({ monthlyVolume: event.target.value })} placeholder="300" />
                  )}
                </FormField>
              </>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-2 sm:col-span-2">
                <QuantityField
                  label={t('recipe.oneBatch')}
                  unit={localizedUnit(draft.outputUnit, locale)}
                  error={errors.outputQty}
                  hint={usedBy.length > 0 ? t('recipe.lockedUnitHint') : t('recipe.batchHint')}
                  autoComplete="off"
                  value={draft.outputQty}
                  onValueChange={(outputQty) => edit({ outputQty })}
                  placeholder="1"
                />
                <FormField label={t('recipe.batchUnit')}>
                  {(control) => (
                    <Select {...control} value={draft.outputUnit} onChange={(event) => edit({ outputUnit: event.target.value as EnteredUnit })}>
                      {outputUnits.map((unit) => <option key={unit} value={unit}>{localizedUnit(unit, locale)}</option>)}
                    </Select>
                  )}
                </FormField>
              </div>
            )}
          </div>
        </Surface>

        <Surface aria-labelledby="recipe-lines-title" className="space-y-4">
          <header className="space-y-1"><h2 id="recipe-lines-title" className="text-xl font-semibold">{kind === 'dish' ? t('recipe.ingredients') : t('recipe.ingredientsAndPreps')}</h2><p className="max-w-prose text-muted-foreground">{t('recipe.lineDescription', { target: t(kind === 'dish' ? 'recipe.targetDish' : 'recipe.targetPrep') })}</p></header>
          <div className="space-y-3">
            {draft.lines.length === 0 ? (
              <p className="border-y border-line py-5 text-center text-muted-foreground">{t('recipe.noLines')}</p>
            ) : (
              <ul className="space-y-3">
                {draft.lines.map((line, index) => (
                  <LineRow
                    key={line.id}
                    line={line}
                    position={index + 1}
                    ingredients={ingredients}
                    preps={preps}
                    catalog={document}
                    errors={errors}
                    cost={lineViews[index]?.cost ?? null}
                    onChange={(next) => editLine(line.id, next)}
                    onRemove={() => removeLine(line.id)}
                  />
                ))}
              </ul>
            )}
            <Button ref={addLineRef} type="button" variant="outline" size="sm" onClick={addLine}>
              <PlusIcon aria-hidden="true" /> {t('recipe.addLine')}
            </Button>
          </div>
        </Surface>

        <CostSummary
          kind={kind}
          costs={costs}
          menuPriceInclVatCents={built.ok && built.recipe.kind === 'dish' ? built.recipe.menuPriceInclVatCents : null}
          outputMilli={built.ok && built.recipe.kind === 'prep' ? built.recipe.outputMilli : null}
          outputUnit={built.ok && built.recipe.kind === 'prep' ? built.recipe.outputUnit : null}
          missing={missing}
          hasLines={draft.lines.length > 0}
        />

        {conflicts.length > 0 && <Surface className="space-y-3" aria-label={t('merge.title')}>
          <h2 className="text-xl font-semibold">{t('merge.title')}</h2>
          <p>{t('merge.description')}</p>
          {conflicts.map(conflict => <div key={conflict.field} className="space-y-2 border-t border-line pt-3">
            <h3 className="font-semibold">{fieldLabels[conflict.field]}</h3>
            <p>{t('merge.mine')}</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">{showValue(conflict.field === 'output' ? { outputQty: draft.outputQty, outputUnit: draft.outputUnit } : draft[conflict.field])}</pre>
            <p>{t('merge.latest')}</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">{showValue(conflict.latest)}</pre>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => resolve(conflict, false)}>{t('merge.keep')}</Button>
              <Button type="button" variant="outline" onClick={() => resolve(conflict, true)}>{t('merge.useLatest')}</Button>
            </div>
          </div>)}
        </Surface>}
        {saveError !== null ? (
          <InlineStatus tone="error">{saveError} {t('recipe.saveErrorKeep')}</InlineStatus>
        ) : null}
        {attempt > 0 && !built.ok ? (
          <InlineStatus tone="error">{t('recipe.validationSummary')}</InlineStatus>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <CommandButton type="submit" disabled={conflicts.length > 0}>{recipe ? t('recipe.saveChanges') : kind === 'dish' ? t('recipe.saveDish') : t('recipe.savePrep')}</CommandButton>
          {recipe ? <Button type="button" variant="outline" disabled={!dirty} onClick={discard}>{t('recipe.discard')}</Button> : null}
          <span role="status" className="text-sm text-muted-foreground">
            {saved ? t('recipe.saved') : dirty && recipe ? t('recipe.unsaved') : ''}
          </span>
          {recipe ? (
            <Button type="button" variant="outline" className="ml-auto text-destructive" onClick={(event) => dialog.open('delete', event)}>
              {t(recipe.kind === 'dish' ? 'recipe.deleteDish' : 'recipe.deletePrep')}
            </Button>
          ) : null}
        </div>
      </fieldset></form>

      {recipe && dialog.state === 'delete' ? (
        <DeleteRecipeDialog
          recipe={recipe}
          onClose={dialog.close}
          onCloseAutoFocus={dialog.onCloseAutoFocus}
          onDeleted={() => { draftCache.clear(draftKey); dialog.close(); window.location.hash = hrefFor({ name: 'recipes' }); }}
        />
      ) : null}
    </section>
  );
}
