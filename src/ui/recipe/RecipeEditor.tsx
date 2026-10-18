import { useMemo, useRef, useState, type FormEvent } from 'react';
import { PlusIcon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import { lineCost, recipeCosts, withRecipe } from '@/ui/domain/recipeCosts';
import type { Prep, Recipe } from '@/ui/domain/types';
import { ALL_UNITS, unitsFor, type EnteredUnit } from '@/ui/forms/numbers';
import {
  buildRecipe, draftFromRecipe, blankDraft, emptyLine, parseLine, recipesUsing, vatOptions,
  type LineDraft, type RecipeDraft,
} from '@/ui/forms/recipeForm';
import { friendlySaveError } from '@/ui/forms/saveError';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useFocusFirstInvalid } from '@/ui/hooks/useFocusFirstInvalid';
import { hrefFor } from '@/ui/router/routes';
import { CostSummary } from './CostSummary';
import { DeleteRecipeDialog } from './DeleteRecipeDialog';
import { LineRow } from './LineRow';

/** Stands in for the id of a recipe that is not saved yet, so its cost can still be calculated. */
const UNSAVED_ID = 'unsaved';

interface RecipeEditorProps {
  /** The saved recipe, or null to create a new one of `kind`. */
  recipe: Recipe | null;
  kind: 'dish' | 'prep';
}

export function RecipeEditor({ recipe, kind }: RecipeEditorProps) {
  const document = useDocument();
  const { execute } = useCommands();
  const [initial] = useState(() => (recipe ? draftFromRecipe(recipe, document) : blankDraft(kind, document.settings.defaultVatRateBp)));
  const [baseline, setBaseline] = useState<RecipeDraft>(initial);
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [attempt, setAttempt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const addLineRef = useRef<HTMLButtonElement>(null);
  const dialog = useDialogState<'delete'>();
  useFocusFirstInvalid(formRef, attempt);

  const id = recipe?.id ?? UNSAVED_ID;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  // Everything below is derived from the draft while rendering: nothing calculated is stored.
  const built = useMemo(() => buildRecipe(draft, id, document), [draft, id, document]);
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
    () => [...document.ingredients].sort((a, b) => a.name.localeCompare(b.name)),
    [document.ingredients],
  );
  const preps = useMemo(
    () => document.recipes
      .filter((entry): entry is Prep => entry.kind === 'prep' && entry.id !== recipe?.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [document.recipes, recipe?.id],
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

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempt((count) => count + 1);
    setSaved(false);
    if (!built.ok) {
      setSaveError(null);
      return;
    }
    const { id: _unsaved, ...input } = built.recipe;
    const toSave = recipe ? { ...input, id: recipe.id } : input;
    const result = execute((store) => store.saveRecipe(toSave), { report: false });
    if (!result.ok) {
      // The draft stays exactly as typed; the saved data is unchanged.
      setSaveError(friendlySaveError(result.error, result.details));
      return;
    }
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
    setAttempt(0);
    setSaveError(null);
    setSaved(false);
  }

  const heading = recipe?.name ?? (kind === 'dish' ? 'New dish' : 'New prep');

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <a href={hrefFor({ name: 'recipes' })} className="text-sm text-muted-foreground underline-offset-4 hover:underline">← All recipes</a>
        <h1 id="page-title" className="text-2xl font-semibold">{heading}</h1>
        <p className="text-sm text-muted-foreground">
          {kind === 'dish'
            ? 'A dish on your menu. Costs are calculated from the lines below at the latest ingredient prices.'
            : 'A prep: a batch you make once and use in dishes. It has no menu price.'}
        </p>
      </div>

      <form ref={formRef} noValidate onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{kind === 'dish' ? 'Dish' : 'Prep'}</CardTitle>
            <CardDescription>Prices are excl. VAT unless marked incl. VAT.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" error={errors.name} className="sm:col-span-2">
              {(control) => (
                <Input
                  {...control}
                  autoComplete="off"
                  value={draft.name}
                  onChange={(event) => edit({ name: event.target.value })}
                  placeholder={kind === 'dish' ? 'Pasta Bolognese' : 'Tomato sauce'}
                />
              )}
            </FormField>

            {kind === 'dish' ? (
              <>
                <FormField label="Menu price (€, incl. VAT)" error={errors.menuPrice} hint="What the guest pays.">
                  {(control) => (
                    <Input {...control} inputMode="decimal" autoComplete="off" value={draft.menuPrice} onChange={(event) => edit({ menuPrice: event.target.value })} placeholder="16.50" />
                  )}
                </FormField>
                <FormField label="VAT rate" error={errors.vatRateBp} hint="9% for food, 21% for alcohol.">
                  {(control) => (
                    <Select {...control} value={draft.vatRateBp} onChange={(event) => edit({ vatRateBp: event.target.value })}>
                      {vatOptions(draft.vatRateBp).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  )}
                </FormField>
                <FormField label="Portions per batch" error={errors.portions} hint="How many portions the lines below make.">
                  {(control) => (
                    <Input {...control} inputMode="numeric" autoComplete="off" value={draft.portions} onChange={(event) => edit({ portions: event.target.value })} />
                  )}
                </FormField>
                <FormField label="Monthly volume (optional)" error={errors.monthlyVolume} hint="Portions sold per month: your estimate, not a forecast.">
                  {(control) => (
                    <Input {...control} inputMode="numeric" autoComplete="off" value={draft.monthlyVolume} onChange={(event) => edit({ monthlyVolume: event.target.value })} placeholder="300" />
                  )}
                </FormField>
              </>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-2 sm:col-span-2">
                <FormField
                  label="One batch makes"
                  error={errors.outputQty}
                  hint={usedBy.length > 0 ? 'Dishes use this prep, so the unit kind (weight, volume, pieces) cannot change.' : 'How much the lines below produce in total.'}
                >
                  {(control) => (
                    <Input {...control} inputMode="decimal" autoComplete="off" value={draft.outputQty} onChange={(event) => edit({ outputQty: event.target.value })} placeholder="1" />
                  )}
                </FormField>
                <FormField label="Batch unit">
                  {(control) => (
                    <Select {...control} value={draft.outputUnit} onChange={(event) => edit({ outputUnit: event.target.value as EnteredUnit })}>
                      {outputUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                    </Select>
                  )}
                </FormField>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{kind === 'dish' ? 'Ingredients' : 'Ingredients and preps'}</CardTitle>
            <CardDescription>
              Net quantity is what ends up in the {kind === 'dish' ? 'batch' : 'prep'}. Yield % is the usable part of what you buy, so 80 means a fifth is lost in trimming or cooking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.lines.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No lines yet. A recipe without lines shows “cost unknown”.
              </p>
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
              <PlusIcon aria-hidden="true" /> Add line
            </Button>
          </CardContent>
        </Card>

        <CostSummary
          kind={kind}
          costs={costs}
          menuPriceInclVatCents={built.ok && built.recipe.kind === 'dish' ? built.recipe.menuPriceInclVatCents : null}
          outputMilli={built.ok && built.recipe.kind === 'prep' ? built.recipe.outputMilli : null}
          outputUnit={built.ok && built.recipe.kind === 'prep' ? built.recipe.outputUnit : null}
          missing={missing}
          hasLines={draft.lines.length > 0}
        />

        {saveError !== null ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {saveError} Your changes are still here, nothing was saved.
          </p>
        ) : null}
        {attempt > 0 && !built.ok ? (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            Some fields need attention. They are marked above.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">{recipe ? 'Save changes' : kind === 'dish' ? 'Save dish' : 'Save prep'}</Button>
          {recipe ? <Button type="button" variant="outline" disabled={!dirty} onClick={discard}>Discard changes</Button> : null}
          <span role="status" className="text-sm text-muted-foreground">
            {saved ? 'Saved.' : dirty && recipe ? 'You have unsaved changes.' : ''}
          </span>
          {recipe ? (
            <Button type="button" variant="outline" className="ml-auto text-destructive" onClick={(event) => dialog.open('delete', event)}>
              Delete {recipe.kind}
            </Button>
          ) : null}
        </div>
      </form>

      {recipe && dialog.state === 'delete' ? (
        <DeleteRecipeDialog
          recipe={recipe}
          onClose={dialog.close}
          onCloseAutoFocus={dialog.onCloseAutoFocus}
          onDeleted={() => { dialog.close(); window.location.hash = hrefFor({ name: 'recipes' }); }}
        />
      ) : null}
    </section>
  );
}
