import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { validateDocument } from '@/store/schema.js';
import type { MenuDocument } from '@/ui/domain/types';
import { useCommands, useDataState, useDataSafety, useVersionHistory } from './DataProvider';
import { useLocale } from '@/ui/i18n';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useRecipeDrafts } from '@/ui/recipe/RecipeDraftProvider';
import { useSimulatorSessions } from '@/ui/simulator/session';
import type { HistoryEntry } from './storeHistory';
import { isSafetyError } from './safetyErrors';

function parse(raw: string): MenuDocument | null {
  try { const doc: unknown = JSON.parse(raw); return validateDocument(doc).valid ? doc as MenuDocument : null; }
  catch { return null; }
}
function changes(a: readonly { readonly id: string }[], b: readonly { readonly id: string }[]) {
  const old = new Map(a.map(item => [item.id, JSON.stringify(item)]));
  const next = new Map(b.map(item => [item.id, JSON.stringify(item)]));
  return [...new Set([...old.keys(), ...next.keys()])].filter(id => old.get(id) !== next.get(id)).length;
}

/** The same list works in recovery without a valid current document. */
export function VersionHistory() {
  const { t, locale } = useLocale();
  const { document } = useDataState();
  const { recoveryRaw } = useDataSafety();
  const { listHistory } = useVersionHistory();
  const { execute } = useCommands();
  const recipes = useRecipeDrafts(), sessions = useSimulatorSessions();
  const dialog = useDialogState<{ entry: HistoryEntry; document: MenuDocument }>();
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const result = useMemo(() => listHistory(), [listHistory, document, recoveryRaw]);
  const entries = useMemo(() => result.ok ? result.value.map(entry => ({ entry, document: parse(entry.raw) })) : [], [result]);
  const stamp = (date: string) => new Date(date).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB');
  const counts = (doc: MenuDocument) => t('history.counts', {
    dishes: doc.recipes.filter(r => r.kind === 'dish').length, preps: doc.recipes.filter(r => r.kind === 'prep').length,
    ingredients: doc.ingredients.length, scenarios: doc.scenarios.length,
  });
  function restore() {
    if (!dialog.state) return;
    const result = execute(store => store.restoreHistory(dialog.state!.entry.id), { report: false });
    if (!result.ok) { setError(isSafetyError(result.code) ? null : t('history.failed')); return; }
    recipes.clearAll(); sessions.clear(); dialog.close(); setRestored(true);
  }
  return <Surface className="space-y-4" aria-labelledby="history-title">
    <h2 id="history-title" className="text-xl font-semibold">{t('history.title')}</h2>
    <p className="max-w-prose text-sm text-muted-foreground">{t('history.limit')}</p>
    {!result.ok && <p role="alert">{t('history.readFailed')}</p>}
    {result.ok && entries.length === 0 && <p>{t('history.empty')}</p>}
    {restored && <p role="status">{t('history.success')}</p>}
    <ul className="divide-y divide-line">
      {entries.map(({ entry, document: snapshot }) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0 space-y-1"><time dateTime={entry.savedAt}>{stamp(entry.savedAt)}</time>
          <p className="text-sm text-muted-foreground">{snapshot ? counts(snapshot) : t('history.invalid')}</p>
        </div>
        <Button type="button" variant="outline" disabled={!snapshot} onClick={event => { if (snapshot) { setError(null); dialog.open({ entry, document: snapshot }, event); } }}>{t('history.preview')}</Button>
      </li>)}
    </ul>
    {dialog.state && <Dialog open onOpenChange={open => { if (!open) dialog.close(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <DialogHeader><DialogTitle>{t('history.confirmTitle')}</DialogTitle><DialogDescription>{t('history.confirmDescription')}</DialogDescription></DialogHeader>
        <p>{t('history.selected')}: {counts(dialog.state.document)}</p>
        {document ? <>
          <p>{t('history.current')}: {counts(document)}</p>
          <p>{t('history.diff', { ingredients: changes(document.ingredients, dialog.state.document.ingredients), recipes: changes(document.recipes, dialog.state.document.recipes), scenarios: changes(document.scenarios, dialog.state.document.scenarios), settings: Number(JSON.stringify(document.settings) !== JSON.stringify(dialog.state.document.settings)) })}</p>
        </> : <p>{t('history.noCurrent')}</p>}
        {error && <p role="alert">{error}</p>}
        <DialogFooter><DialogClose asChild><Button type="button" variant="outline">{t('data.cancel')}</Button></DialogClose><Button type="button" onClick={restore}>{t('history.restore')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>}
  </Surface>;
}
