import { useLocale, useFormatters } from '@/ui/i18n';
import { useMemo, useReducer, useRef, useState } from 'react';
import { ArrowLeftIcon, PlusIcon } from 'lucide-react';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { MoneyValue } from '@/components/ui/money-value';
import './simulator.css';
import { Input } from '@/components/ui/input';
import { isSafetyError } from '@/ui/data/safetyErrors';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import {
  compareRuns, isStale, NO_CHANGES, rebaseOverrides, runScenario, takeBaseline, type Run, type ScenarioOverrides,
} from '@/ui/domain/simulator';
import type { Dish, Scenario, ScenarioInput } from '@/ui/domain/types';
import { HelpLink } from '@/ui/help/HelpLink';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { hrefFor } from '@/ui/router/routes';
import { BaselineCards } from './BaselineCards';
import { ComparisonTable, type Column } from './ComparisonTable';
import { DeleteScenarioDialog } from './DeleteScenarioDialog';
import { ScenarioCard } from './ScenarioCard';
import {
  emptyFields, parseSharedVolume, validateName, type FieldsDraft, type FormErrorKey,
} from './scenarioForm';
import {
  defaultName, slotLetter, draftsFromSaved, isUnsaved, MAX_SCENARIOS, newDraft, scenariosReducer, type ScenarioDraft,
} from './scenarios';
import { useRememberSession, useSimulatorSessions, type DishSession } from './session';

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

const okResult = (run: Run | undefined) => (run?.ok ? run.result : null);

const failedRun = (error: string): Run => ({ ok: false, error });

/** The simulator for one dish: Baseline, up to three scenarios, and the comparison. */
export function Workbench({ dish }: { dish: Dish }) {
  const { t, plural } = useLocale(); const f = useFormatters();
  const document = useDocument();
  const { execute, commandStatus } = useCommands();
  const dishHasVolume = dish.monthlyVolume !== undefined && dish.monthlyVolume !== null;

  // The page compares against current real data; scenario snapshots stay unchanged.
  const pageBaseline = useMemo(() => takeBaseline(document, dish.id, new Date().toISOString()), [document, dish.id]);
  // Coming back to the dish restores what was being edited (kept in memory only).
  const sessions = useSimulatorSessions();
  const [remembered] = useState<DishSession | undefined>(() => sessions.get(dish.id));
  const [drafts, dispatch] = useReducer(
    scenariosReducer,
    undefined,
    () => remembered?.drafts ?? draftsFromSaved(document.scenarios.filter((scenario: Scenario) => scenario.recipeId === dish.id)),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const activeKey = drafts.some(d => d.key === selectedKey) ? selectedKey! : drafts[0]?.key;
  const [volumeText, setVolumeText] = useState(remembered?.volumeText ?? (dishHasVolume ? String(dish.monthlyVolume) : ''));
  const [sharedVolume, setSharedVolume] = useState<number | undefined>(
    remembered ? remembered.sharedVolume : dishHasVolume ? dish.monthlyVolume ?? undefined : undefined,
  );
  const [volumeError, setVolumeError] = useState<string | undefined>(remembered?.volumeError);
  const [problems, setProblems] = useState<Record<string, FormErrorKey | null>>({});
  const [attempts, setAttempts] = useState<Record<string, number>>({});
  const counter = useRef(0);
  const deleting = useDialogState<string>();
  const session = useMemo(() => ({ drafts, volumeText, sharedVolume, volumeError }), [drafts, volumeText, sharedVolume, volumeError]);
  useRememberSession(dish.id, session);

  const setProblem = (key: string, message: FormErrorKey | null) => setProblems((current) => ({ ...current, [key]: message }));

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
    () => new Set(drafts.filter((draft) => isStale(draft.baseline, document)).map((draft) => draft.key)),
    [drafts, document],
  );
  const runs = useMemo(
    () => drafts.map((draft) => runScenario(draft.baseline, withSharedVolume(draft.applied, sharedVolume))),
    [drafts, sharedVolume],
  );
  // What each scenario started from: its own baseline, which may be older than today's.
  const ownBaselines = useMemo(() => drafts.map((draft) => runScenario(draft.baseline, NO_CHANGES)), [drafts]);
  const deltas = useMemo(
    () => (baselineRun.ok ? compareRuns(baselineRun.result, runs) : runs.map(() => null)),
    [baselineRun, runs],
  );
  const columns: Column[] = [
    { key: 'baseline', label: t('simulator.baseline'), kind: 'baseline', run: baselineRun, delta: null, stale: false },
    ...drafts.map((draft, index): Column => ({
      key: draft.key,
      label: draft.name.trim() === '' ? t('simulator.unnamed') : draft.name,
      kind: 'scenario',
      run: runs[index] ?? failedRun('simulator.failedScenario'),
      delta: staleKeys.has(draft.key) ? null : deltas[index] ?? null,
      stale: staleKeys.has(draft.key),
    })),
  ];

  function addScenario() {
    if (!pageBaseline.ok || drafts.length >= MAX_SCENARIOS) return;
    counter.current += 1;
    const key = `new-${Date.now().toString(36)}-${counter.current}`;
    setSelectedKey(key);
    dispatch({ type: 'added', draft: newDraft(key, defaultName(drafts), pageBaseline.baseline, emptyFields(pageBaseline.baseline)) });
  }

  async function save(draft: ScenarioDraft) {
    if (validateName(draft.name) !== null || Object.keys(draft.errors).length > 0) {
      setAttempts((current) => ({ ...current, [draft.key]: (current[draft.key] ?? 0) + 1 }));
      return;
    }
    // The sales estimate the result was calculated with is saved too, so it can be reproduced.
    const overrides = withSharedVolume(draft.applied, sharedVolume);
    const input = toScenarioInput(draft, dish.id, draft.baseline, overrides);
    const result = (await execute((store) => store.saveScenario(input), { report: false }));
    if (result.ok) {
      setProblem(draft.key, null);
      dispatch({ type: 'saved', key: draft.key, id: result.value.id, createdAt: input.createdAt, overrides });
    } else {
      setProblem(draft.key, isSafetyError(result.code) ? null : 'simulator.error.save'); // the typed values stay in the card
    }
  }

  /** Calculate this scenario on today's data. Only the draft changes; Save writes it. */
  function updateBaseline(draft: ScenarioDraft) {
    const fresh = takeBaseline(document, dish.id, new Date().toISOString());
    if (!fresh.ok) {
      setProblem(draft.key, 'simulator.error.save');
      return;
    }
    setProblem(draft.key, null);
    dispatch({ type: 'rebased', key: draft.key, baseline: fresh.baseline, rebased: rebaseOverrides(draft.baseline, fresh.baseline, draft.applied) });
  }

  /** Remove a scenario; a saved one is deleted from the store first. Returns why it failed, if it did. */
  async function remove(draft: ScenarioDraft): Promise<string | null> {
    if (draft.id !== null) {
      const id = draft.id;
      const result = (await execute((store) => store.deleteScenario(id), { report: false }));
      if (!result.ok) return isSafetyError(result.code) ? null : t('simulator.error.save');
    }
    dispatch({ type: 'removed', key: draft.key });
    deleting.close();
    return null;
  }

  const deletingDraft = drafts.find((draft) => draft.key === deleting.state) ?? null;

  const activeIndex = drafts.findIndex(draft => draft.key === activeKey);
  const active = drafts[activeIndex];
  const activeRun = runs[activeIndex];
  const activeDelta = active && !staleKeys.has(active.key) ? deltas[activeIndex]?.monthlyContributionDeltaCents ?? null : null;
  return <section aria-labelledby="page-title" className="space-y-6"><fieldset disabled={commandStatus === 'saving'} className="contents">
    <div className="space-y-2">
      <Button asChild variant="ghost" className="-ml-3 no-print"><a href={hrefFor({ name: 'simulator', id: null })}><ArrowLeftIcon aria-hidden="true" />{t('simulator.allDishes')}</a></Button>
      <h1 id="page-title" className="text-[31px] leading-tight font-semibold sm:text-4xl">{t('simulator.heading', { name: dish.name })}</h1>
      <p className="max-w-3xl text-muted-foreground">{t('simulator.intro')}</p>
      {pageBaseline.ok && <p className="text-sm text-muted-foreground">{t('simulator.baseline')} · {f.date(pageBaseline.baseline.takenAt)}</p>}
      <HelpLink section="simulator" className="no-print" />
    </div>
    {active ? <Surface aria-label={t('simulator.result', { letter: slotLetter(activeIndex) })} className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-xl font-semibold">{active.name || t('simulator.unnamed')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('simulator.monthlyDelta')} {t('simulator.againstBaseline')}</p></div>
      <div className="min-w-0 max-w-full text-right"><MoneyValue value={activeDelta === null ? '—' : `${activeDelta > 0n ? '+' : ''}${f.money(activeDelta)}`} tone={activeDelta === null || activeDelta === 0n ? 'neutral' : activeDelta > 0n ? 'positive' : 'negative'} className="block break-words text-[46px] leading-tight sm:text-[60px]" />
        <p className="mt-2 text-sm text-muted-foreground">{staleKeys.has(active.key) ? t('simulator.older') : activeRun?.ok && activeRun.result.monthlyVolume !== null ? plural('simulator.resultHint', activeRun.result.monthlyVolume, { count: f.integer(activeRun.result.monthlyVolume) }) : t('simulator.noEstimate')}</p>
      </div>
    </Surface> : <BaselineCards run={baselineRun} />}
    <div className="sim-workbench grid items-start gap-6 lg:grid-rows-[auto_1fr] lg:grid-cols-[238px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
    <div className="sim-selector lg:col-start-2 flex-1 flex flex-wrap items-end justify-between gap-4 border-y border-line py-4 no-print">
      {drafts.length > 0 ? <fieldset className="min-w-0 w-full basis-full lg:w-auto lg:basis-0 lg:flex-1"><legend className="mb-2 text-sm font-semibold">{t('simulator.chooseScenario')}</legend><div className="grid grid-cols-3 gap-2">
        {drafts.map((draft, index) => <label key={draft.key} className={`flex min-h-12 min-w-0 cursor-pointer items-center justify-center gap-1 rounded border px-1 text-sm ${draft.key === activeKey ? 'border-current bg-accent text-accent-foreground' : 'border-input bg-surface'}`}>
          <input type="radio" name="active-scenario" aria-label={t('simulator.scenario', { letter: slotLetter(index) })} value={draft.key} checked={draft.key === activeKey} onChange={() => setSelectedKey(draft.key)} /><span><span className="whitespace-nowrap">{t('simulator.scenario', { letter: slotLetter(index) })}</span>{draft.name && draft.name !== t('simulator.scenario', { letter: slotLetter(index) }) && <span className="block break-words text-xs">{draft.name}</span>}</span>
        </label>)}
      </div></fieldset> : <h2 className="text-xl font-semibold">{t('simulator.scenarios')}</h2>}
      <Button onClick={addScenario} disabled={!pageBaseline.ok || drafts.length >= MAX_SCENARIOS} variant={drafts.length === 0 ? 'default' : 'outline'}><PlusIcon aria-hidden="true" />{drafts.length >= MAX_SCENARIOS ? t('simulator.limit', { count: f.integer(MAX_SCENARIOS) }) : t('simulator.add')}</Button>
    </div>
      <aside className="sim-editor lg:row-start-1 lg:row-span-2 space-y-5 rounded-lg border border-line bg-surface p-4 no-print">
        <h2 className="text-xl font-semibold">{t('simulator.edit')}</h2>

        {drafts.map((draft, index) => <div key={draft.key} hidden={draft.key !== activeKey}>
              <ScenarioCard
                key={draft.key}
                draft={draft}
                index={index}
                run={runs[index] ?? failedRun('simulator.failedScenario')}
                delta={deltas[index] ?? null}
                ownBaseline={okResult(ownBaselines[index])}
                sharedVolume={sharedVolume}
                stale={staleKeys.has(draft.key)}
                dirty={isUnsaved(draft)}
                problem={problems[draft.key] ? t(problems[draft.key]!) : null}
                attempt={attempts[draft.key] ?? 0}
                onRename={(name) => dispatch({ type: 'renamed', key: draft.key, name })}
                onFields={(fields: FieldsDraft) => dispatch({ type: 'fieldsChanged', key: draft.key, fields })}
                onSave={() => save(draft)}
                onDelete={(event) => { if (draft.id === null) remove(draft); else deleting.open(draft.key, event); }}
                onUpdateBaseline={() => updateBaseline(draft)}
                onDismissNotes={() => dispatch({ type: 'notesDismissed', key: draft.key })}
              />
        </div>)}
        <details open={drafts.length === 0 || !!volumeError || undefined}>
          <summary className="flex min-h-12 cursor-pointer items-center text-sm underline underline-offset-4">{t('simulator.sharedVolume')}</summary>
        <FormField className="[&>label]:sr-only" label={t('simulator.sharedVolume')} hint={t('simulator.sharedHint')} error={volumeError ? t(volumeError as 'simulator.error.volume' | 'simulator.error.estimate') : undefined}>
          {control => <Input {...control} inputMode="numeric" autoComplete="off" value={volumeText} onChange={event => changeVolume(event.target.value)} />}
        </FormField>
        </details>
      </aside>
      {drafts.length > 0 ? <ComparisonTable columns={columns} activeKey={activeKey} /> : <Surface aria-labelledby="empty-scenarios">
        <h2 id="empty-scenarios" className="text-xl font-semibold">{t('simulator.empty')}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t('simulator.emptyDescription', { name: dish.name, count: f.integer(MAX_SCENARIOS) })}</p>
        <p className="mt-4 text-sm text-muted-foreground">{t('simulator.disclaimer')}</p>
      </Surface>}
    </div>
    {deletingDraft && <DeleteScenarioDialog name={deletingDraft.name} onClose={deleting.close} onCloseAutoFocus={deleting.onCloseAutoFocus} onConfirm={() => remove(deletingDraft)} />}
  </fieldset></section>;
}
