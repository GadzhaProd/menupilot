import { useLocalMode } from './localMode';
import { CommandButton } from '@/ui/data/CommandButton';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CommandResult } from './DataProvider';
import type { MenuDocument } from '@/ui/domain/types';
import { useCommands, useDataState, useDataSafety, useVersionHistory } from './DataProvider';
import { useLocale } from '@/ui/i18n';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useRecipeDrafts } from '@/ui/recipe/RecipeDraftProvider';
import { useSimulatorSessions } from '@/ui/simulator/session';
import type { HistoryEntry } from '@/ui/domain/store';
import { isSafetyError } from './safetyErrors';

function changes(a: readonly { readonly id: string }[], b: readonly { readonly id: string }[]) {
  const old = new Map(a.map(item => [item.id, JSON.stringify(item)]));
  const next = new Map(b.map(item => [item.id, JSON.stringify(item)]));
  return [...new Set([...old.keys(), ...next.keys()])].filter(id => old.get(id) !== next.get(id)).length;
}

/** The same list works in recovery without a valid current document. */
export function VersionHistory() {
  const { t, locale } = useLocale();
  const local = useLocalMode();
  const { document } = useDataState();
  const { recoveryRaw } = useDataSafety();
  const { listHistory, readHistory } = useVersionHistory();
  const { execute, commandStatus } = useCommands();
  const recipes = useRecipeDrafts(), sessions = useSimulatorSessions();
  const dialog = useDialogState<{ entry: HistoryEntry; document: MenuDocument }>();
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [result, setResult] = useState<CommandResult<readonly HistoryEntry[]>>({ ok: true, value: [] });
  useEffect(() => {
    let active = true;
    void listHistory().then(value => { if (active) setResult(value); });
    return () => { active = false; };
  }, [listHistory, document, recoveryRaw]);
  const entries = result.ok ? result.value : [];
  const stamp = (date: string) => new Date(date).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB');
  const counts = (doc: MenuDocument) => t('history.counts', {
    dishes: doc.recipes.filter(r => r.kind === 'dish').length, preps: doc.recipes.filter(r => r.kind === 'prep').length,
    ingredients: doc.ingredients.length, scenarios: doc.scenarios.length,
  });
  async function restore() {
    if (!dialog.state) return;
    const result = (await execute(store => store.restoreHistory(dialog.state!.entry.id), { report: false }));
    if (!result.ok) { setError(isSafetyError(result.code) ? null : t(result.details.some(detail => detail.includes('must not be in the future')) ? 'history.futurePrices' : 'history.failed')); return; }
    recipes.clearAll(); sessions.clear(); dialog.close(); setRestored(true);
  }
  return <Surface className="space-y-4" aria-labelledby="history-title">
    <h2 id="history-title" className="text-xl font-semibold">{t('history.title')}</h2>
    <p className="max-w-prose text-sm text-muted-foreground">{local ? (locale === 'nl' ? 'Maximaal 32 eerdere versies, binnen 64 MiB, op deze computer. Bewaar ook een aparte export.' : 'Up to 32 previous versions, within 64 MiB, on this computer. Keep a separate export too.') : t('history.limit')}</p>
    {!result.ok && <p role="alert">{t('history.readFailed')}</p>}
    {result.ok && entries.length === 0 && <p>{t('history.empty')}</p>}
    {restored && <p role="status">{t('history.success')}</p>}
    {error && !dialog.state && <p role="alert">{error}</p>}
    <ul className="divide-y divide-line">
      {entries.map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 space-y-1"><time dateTime={entry.savedAt}>{stamp(entry.savedAt)}</time>

        </div>
        <Button type="button" variant="outline" onClick={async event => {
          const trigger = event.currentTarget;
          const snapshot = await readHistory(entry.id);
          if (snapshot.ok) { setError(null); dialog.open({ entry, document: snapshot.value }, { currentTarget: trigger }); }
          else setError(snapshot.error);
        }}>{t('history.preview')}</Button>
      </li>)}
    </ul>
    {dialog.state && <Dialog open onOpenChange={open => { if (!open && commandStatus !== 'saving') dialog.close(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <DialogHeader><DialogTitle>{t('history.confirmTitle')}</DialogTitle><DialogDescription>{t('history.confirmDescription')}</DialogDescription></DialogHeader>
        <p>{t('history.selected')}: {counts(dialog.state.document)}</p>
        {document ? <>
          <p>{t('history.current')}: {counts(document)}</p>
          <p>{t('history.diff', { ingredients: changes(document.ingredients, dialog.state.document.ingredients), recipes: changes(document.recipes, dialog.state.document.recipes), scenarios: changes(document.scenarios, dialog.state.document.scenarios), settings: Number(JSON.stringify(document.settings) !== JSON.stringify(dialog.state.document.settings)) })}</p>
        </> : <p>{t('history.noCurrent')}</p>}
        {error && <p role="alert">{error}</p>}
        <DialogFooter><DialogClose asChild><Button disabled={commandStatus === 'saving'} type="button" variant="outline">{t('data.cancel')}</Button></DialogClose><CommandButton type="button" onClick={restore}>{t('history.restore')}</CommandButton></DialogFooter>
      </DialogContent>
    </Dialog>}
  </Surface>;
}
