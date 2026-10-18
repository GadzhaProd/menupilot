import { useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeftIcon, FlaskConicalIcon, PlusIcon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import {
  compareRuns, isStale, NO_CHANGES, rebaseOverrides, runScenario, takeBaseline, type Run, type ScenarioOverrides,
} from '@/ui/domain/simulator';
import type { Dish, Scenario, ScenarioInput } from '@/ui/domain/types';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { hrefFor } from '@/ui/router/routes';
import { BaselineCards } from './BaselineCards';
import { ComparisonTable, type Column } from './ComparisonTable';
import { DeleteScenarioDialog } from './DeleteScenarioDialog';
import { ScenarioCard } from './ScenarioCard';
import {
  emptyFields, parseSharedVolume, signature, validateName, type FieldsDraft,
} from './scenarioForm';
import {
  defaultName, draftsFromSaved, MAX_SCENARIOS, newDraft, scenariosReducer, type ScenarioDraft,
} from './scenarios';

/** What the store keeps of a draft: the name, the baseline it was calculated on, and its changes. */
function toScenarioInput(draft: ScenarioDraft, recipeId: string, baseline = draft.baseline, overrides: ScenarioOverrides = draft.applied): ScenarioInput {
  return {
    ...(draft.id !== null && { id: draft.id }),
    recipeId,
    name: draft.name.trim(),
    createdAt: draft.createdAt ?? new Date().toISOString(),
    baseline,
    overrides,
  };
}

function withSharedVolume(overrides: ScenarioOverrides, shared: number | undefined): ScenarioOverrides {
  return overrides.monthlyVolume === undefined && shared !== undefined ? { ...overrides, monthlyVolume: shared } : overrides;
}

const failedRun = (error: string): Run => ({ ok: false, error });

/** The simulator for one dish: Baseline, up to three scenarios, and the comparison. */
export function Workbench({ dish }: { dish: Dish }) {
  const document = useDocument();
  const { execute } = useCommands();
  const dishHasVolume = dish.monthlyVolume !== undefined && dish.monthlyVolume !== null;

  // Baseline is a snapshot taken when the screen opens; it is never edited.
  const [pageBaseline] = useState(() => takeBaseline(document, dish.id, new Date().toISOString()));
  const [drafts, dispatch] = useReducer(
    scenariosReducer,
    undefined,
    () => draftsFromSaved(document.scenarios.filter((scenario: Scenario) => scenario.recipeId === dish.id)),
  );
  const [volumeText, setVolumeText] = useState(dishHasVolume ? String(dish.monthlyVolume) : '');
  const [sharedVolume, setSharedVolume] = useState<number | undefined>(dishHasVolume ? dish.monthlyVolume ?? undefined : undefined);
  const [volumeError, setVolumeError] = useState<string | undefined>();
  const [problems, setProblems] = useState<Record<string, string | null>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const counter = useRef(0);
  const deleting = useDialogState<string>();

  const setProblem = (key: string, message: string | null) => setProblems((current) => ({ ...current, [key]: message }));

  function changeVolume(text: string) {
    setVolumeText(text);
    const parsed = parseSharedVolume(text, dishHasVolume);
    if (parsed.ok) {
      setVolumeError(undefined);
      setSharedVolume(parsed.value);
    } else {
      setVolumeError(parsed.error); // the last valid estimate keeps being used
    }
  }

  // Derived BigInt results: recomputed from the drafts, never stored.
  const baselineRun: Run = useMemo(
    () => (pageBaseline.ok
      ? runScenario(pageBaseline.baseline, withSharedVolume(NO_CHANGES, sharedVolume))
      : failedRun(pageBaseline.error)),
    [pageBaseline, sharedVolume],
  );
  const staleKeys = useMemo(
    () => new Set(drafts.filter((draft) => draft.id !== null && isStale(draft.baseline, document)).map((draft) => draft.key)),
    [drafts, document],
  );
  const runs = useMemo(
    () => drafts.map((draft) => runScenario(draft.baseline, withSharedVolume(draft.applied, sharedVolume))),
    [drafts, sharedVolume],
  );
  const deltas = useMemo(
    () => (baselineRun.ok ? compareRuns(baselineRun.result, runs) : runs.map(() => null)),
    [baselineRun, runs],
  );
  const columns: Column[] = [
    { key: 'baseline', label: 'Baseline', kind: 'baseline', run: baselineRun, delta: null, stale: false },
    ...drafts.map((draft, index): Column => ({
      key: draft.key,
      label: draft.name.trim() === '' ? 'Unnamed' : draft.name,
      kind: 'scenario',
      run: runs[index] ?? failedRun('No result.'),
      delta: staleKeys.has(draft.key) ? null : deltas[index] ?? null,
      stale: staleKeys.has(draft.key),
    })),
  ];

  function addScenario() {
    if (!pageBaseline.ok || drafts.length >= MAX_SCENARIOS) return;
    counter.current += 1;
    dispatch({ type: 'added', draft: newDraft(`new-${counter.current}`, defaultName(drafts), pageBaseline.baseline, emptyFields(pageBaseline.baseline)) });
  }

  function save(draft: ScenarioDraft) {
    if (validateName(draft.name) !== null || Object.keys(draft.errors).length > 0) {
      setAttempts((current) => ({ ...current, [draft.key]: (current[draft.key] ?? 0) + 1 }));
      return;
    }
    const input = toScenarioInput(draft, dish.id);
    const result = execute((store) => store.saveScenario(input), { report: false });
    if (result.ok) {
      setProblem(draft.key, null);
      dispatch({ type: 'saved', key: draft.key, id: result.value.id, createdAt: input.createdAt, savedSignature: signature(draft.name, draft.applied) });
    } else {
      setProblem(draft.key, result.error); // the typed values stay in the card
    }
  }

  function updateBaseline(draft: ScenarioDraft) {
    const fresh = takeBaseline(document, dish.id, new Date().toISOString());
    if (!fresh.ok) {
      setProblem(draft.key, fresh.error);
      return;
    }
    const carried = rebaseOverrides(draft.baseline, fresh.baseline, draft.applied);
    const result = execute(
      (store) => store.saveScenario(toScenarioInput(draft, dish.id, fresh.baseline, carried.overrides)),
      { report: false },
    );
    if (result.ok) {
      setProblem(draft.key, null);
      dispatch({
        type: 'rebased', key: draft.key, baseline: fresh.baseline, overrides: carried.overrides, notes: carried.dropped,
        savedSignature: signature(draft.name, carried.overrides),
      });
    } else {
      setProblem(draft.key, result.error);
    }
  }

  /** Remove a scenario; a saved one is deleted from the store first. Returns why it failed, if it did. */
  function remove(draft: ScenarioDraft): string | null {
    if (draft.id !== null) {
      const id = draft.id;
      const result = execute((store) => store.deleteScenario(id), { report: false });
      if (!result.ok) return result.error;
    }
    dispatch({ type: 'removed', key: draft.key });
    deleting.close();
    return null;
  }

  const deletingDraft = drafts.find((draft) => draft.key === deleting.state) ?? null;

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <a href={hrefFor({ name: 'simulator', id: null })}><ArrowLeftIcon aria-hidden="true" /> All dishes</a>
        </Button>
        <h1 id="page-title" className="text-2xl font-semibold">Simulator: {dish.name}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Try what-if changes on a copy of this dish and compare them with today. Nothing here changes your real prices or recipes.
        </p>
      </div>

      <BaselineCards run={baselineRun} />

      <Card className="py-4">
        <CardContent className="px-4">
          <FormField
            label="Expected sales per month (your estimate)"
            hint="Portions you expect to sell per month. It is your own number, not a forecast, and it is used by Baseline and every scenario unless a scenario has its own."
            error={volumeError}
            className="max-w-md"
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                autoComplete="off"
                value={volumeText}
                onChange={(event) => changeVolume(event.target.value)}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      {drafts.length > 0 ? <ComparisonTable columns={columns} /> : null}

      <section aria-labelledby="scenarios-title" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="scenarios-title" className="text-lg font-semibold">Scenarios</h2>
          <Button onClick={addScenario} disabled={!pageBaseline.ok || drafts.length >= MAX_SCENARIOS} variant={drafts.length === 0 ? 'default' : 'outline'}>
            <PlusIcon aria-hidden="true" /> {drafts.length >= MAX_SCENARIOS ? `Up to ${MAX_SCENARIOS} scenarios` : 'Add scenario'}
          </Button>
        </div>
        {drafts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <FlaskConicalIcon aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="font-medium">No scenarios yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              A scenario is a what-if copy of {dish.name}. Change the menu price, an ingredient price or a quantity and see the result at once. Add up to {MAX_SCENARIOS} and compare them with Baseline.
            </p>
          </div>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {drafts.map((draft, index) => (
              <ScenarioCard
                key={draft.key}
                draft={draft}
                index={index}
                run={runs[index] ?? failedRun('No result.')}
                delta={deltas[index] ?? null}
                baseline={baselineRun.ok ? baselineRun.result : null}
                sharedVolume={sharedVolume}
                stale={staleKeys.has(draft.key)}
                dirty={signature(draft.name, draft.applied) !== draft.savedSignature}
                problem={problems[draft.key] ?? null}
                attempt={attempts[draft.key] ?? 0}
                onRename={(name) => dispatch({ type: 'renamed', key: draft.key, name })}
                onFields={(fields: FieldsDraft) => dispatch({ type: 'fieldsChanged', key: draft.key, fields })}
                onSave={() => save(draft)}
                onDelete={(event) => { if (draft.id === null) remove(draft); else deleting.open(draft.key, event); }}
                onUpdateBaseline={() => updateBaseline(draft)}
                onDismissNotes={() => dispatch({ type: 'notesDismissed', key: draft.key })}
              />
            ))}
          </div>
        )}
      </section>

      {deletingDraft ? (
        <DeleteScenarioDialog
          name={deletingDraft.name}
          onClose={deleting.close}
          onCloseAutoFocus={deleting.onCloseAutoFocus}
          onConfirm={() => remove(deletingDraft)}
        />
      ) : null}
    </section>
  );
}
