import { useSimulatorSessions } from '@/ui/simulator/session';
import { useRecipeDrafts } from '@/ui/recipe/RecipeDraftProvider';
import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { InlineStatus } from '@/components/ui/inline-status';
import { Surface } from '@/components/ui/surface';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCommands, useDataSafety } from '@/ui/data/DataProvider';
import { demoForLocale } from '@/ui/data/demo';
import { createStore } from '@/ui/domain/store';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useLocale } from '@/ui/i18n';
import { downloadText } from '@/ui/data/downloadText';

type Pending = { kind: 'import'; text: string; fileName: string } | { kind: 'demo' | 'empty' };

/** Recovery never requires a valid current document. Replacement still uses the store's CAS. */
export function RecoveryPage() {
  const { t, locale } = useLocale();
  const { recoveryRaw, loadCode } = useDataSafety();
  const { execute } = useCommands();
  const recipes = useRecipeDrafts();
  const sessions = useSimulatorSessions();
  const fileInput = useRef<HTMLInputElement>(null);
  const importButton = useRef<HTMLButtonElement>(null);
  const dialog = useDialogState<Pending>();
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const rawAvailable = recoveryRaw !== null;

  function download() {
    if (recoveryRaw === null) return;
    try {
      downloadText(recoveryRaw, `menupilot-damaged-${new Date().toISOString().slice(0, 10)}.txt`);
      setDownloaded(true);
    } catch { setError(t('data.downloadFail', { error: t('error.generic') })); }
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 5_000_000) { setError(t('data.fileTooLarge', { file: file.name })); return; }
    let text: string;
    try { text = await file.text(); }
    catch { setError(t('data.fileUnreadable', { file: file.name })); return; }
    // The normal store parser/schema checks the backup, but writes only to isolated memory.
    // The real store validates once more, against its clock, on explicit confirmation.
    try {
      const probe = createStore({ getItem: () => null, setItem: () => {} }, { demo: demoForLocale(locale) });
      probe.load(); probe.importJSON(text);
    } catch { setError(t('recovery.invalidBackup')); return; }
    setError(null);
    dialog.open({ kind: 'import', text, fileName: file.name }, { currentTarget: importButton.current ?? input });
  }

  function confirm() {
    const pending = dialog.state;
    if (!pending) return;
    const result = pending.kind === 'import' ? execute(store => store.importJSON(pending.text), { report: false })
      : pending.kind === 'empty' ? execute(store => store.resetToEmpty(), { report: false })
        : execute(store => store.resetToDemo(demoForLocale(locale)), { report: false });
    if (result.ok) { recipes.clearAll(); sessions.clear(); dialog.close(); }
    else if (['conflict', 'write-busy', 'write-unavailable'].includes(result.code)) setError(null);
    else setError(t('recovery.failed'));
  }

  const reason = loadCode === 'corrupt-json' ? t('recovery.corrupt') : loadCode === 'unsupported-version'
    ? t('recovery.version') : loadCode === 'invalid' ? t('recovery.invalid') : t('recovery.blocked');
  return <section aria-labelledby="page-title" className="max-w-3xl space-y-6">
    <h1 id="page-title" className="text-3xl font-semibold">{t('error.dataTitle')}</h1>
    <InlineStatus tone="error">{reason}</InlineStatus>
    <p className="text-muted-foreground">{t('recovery.explanation')}</p>
    <Surface className="space-y-4">
      <Button type="button" className="whitespace-normal" disabled={!rawAvailable} onClick={download}>{t('recovery.download')}</Button>
      {downloaded && <p role="status">{t('recovery.downloaded')}</p>}
      <div>
        <input ref={fileInput} type="file" accept=".json,application/json" aria-label={t('data.backupFile')} className="hidden" disabled={!rawAvailable} onChange={chooseFile} />
        <Button ref={importButton} type="button" variant="outline" className="whitespace-normal" disabled={!rawAvailable} onClick={() => fileInput.current?.click()}>{t('recovery.restore')}</Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" className="whitespace-normal" disabled={!rawAvailable} onClick={event => { setError(null); dialog.open({ kind: 'demo' }, event); }}>{t('recovery.demo')}</Button>
        <Button type="button" variant="outline" className="whitespace-normal" disabled={!rawAvailable} onClick={event => { setError(null); dialog.open({ kind: 'empty' }, event); }}>{t('recovery.empty')}</Button>
      </div>
    </Surface>
    {error && !dialog.state && <InlineStatus tone="error">{error}</InlineStatus>}
    {dialog.state && <Dialog open onOpenChange={open => { if (!open) dialog.close(); }}>
      <DialogContent role="alertdialog" onCloseAutoFocus={dialog.onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>{dialog.state.kind === 'import' ? t('data.confirmImport') : t('recovery.confirm')}</DialogTitle>
          <DialogDescription>{t('recovery.warning')}</DialogDescription>
        </DialogHeader>
        <p>{dialog.state.kind === 'import' ? dialog.state.fileName : dialog.state.kind === 'empty' ? t('recovery.empty') : t('recovery.demo')}</p>
        {error && <InlineStatus tone="error">{error}</InlineStatus>}
        <Button type="button" variant="outline" className="whitespace-normal" onClick={download}>{t('recovery.download')}</Button>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">{t('data.cancel')}</Button></DialogClose>
          <Button type="button" variant="destructive" className="whitespace-normal" onClick={confirm}>{dialog.state.kind === 'import' ? t('data.replaceBackup') : t('recovery.replace')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>}
  </section>;
}
