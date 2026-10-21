import { CommandButton } from '@/ui/data/CommandButton';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/i18n';
import { useSimulatorSessions } from '@/ui/simulator/session';
import { useRecipeDrafts } from '@/ui/recipe/RecipeDraftProvider';
import { downloadText } from './downloadText';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCommands, useDataSafety, useVersionHistory } from './DataProvider';

/** Keep the action reachable inside a modal's focus trap as well as on a page. */
export function DataSafetyNotice() {
  const { t } = useLocale();
  const { safety, removedTargets, reloadLatest, activateEditing, registerDraftSource, draftsChanged, migrationSource, confirmMigrationDownload } = useDataSafety();
  const sessions = useSimulatorSessions();
  const recipes = useRecipeDrafts();
  const { exportBackup, execute, commandStatus } = useCommands();
  const { historyWarning, backupStatus, backupError, remindLater, recordExport } = useVersionHistory();
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [migrationDownload, setMigrationDownload] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState(false);
  const [dialog, setDialog] = useState<Element | null>(null);
  useEffect(() => {
    const unregister = registerDraftSource(() => sessions.unsavedTotal() > 0, sessions.draftTargets);
    const unsubscribe = sessions.subscribe(draftsChanged);
    return () => { unregister(); unsubscribe(); };
  }, [registerDraftSource, draftsChanged, sessions]);
  useEffect(() => {
    const unregister = registerDraftSource(recipes.hasDrafts, recipes.targets);
    const unsubscribe = recipes.subscribe(draftsChanged);
    return () => { unregister(); unsubscribe(); };
  }, [registerDraftSource, draftsChanged, recipes]);
  useEffect(() => {
    if (!safety && commandStatus !== 'saving') { setDialog(null); return; }
    const find = () => setDialog(document.querySelector('[role="dialog"], [role="alertdialog"]'));
    find();
    const observer = new MutationObserver(find);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [safety, commandStatus]);
  const backupAlert = backupError && <p role="alert" className="rounded-md border border-amber-500/50 p-3">{backupError}</p>;
  const commandNotice = commandStatus !== 'idle' && commandStatus !== 'conflict' && <p role="status" className="text-sm text-muted-foreground">{t(commandStatus === 'saving' ? 'commands.saving' : commandStatus === 'saved' ? 'commands.saved' : 'commands.error')}</p>;
  if (!safety) return <>
    {dialog ? createPortal(commandNotice, dialog) : commandNotice}
    {backupAlert}
    {historyWarning && <p role="status" className="rounded-md border border-amber-500/50 p-3">{t('history.unavailable')}</p>}
    {backupStatus.due && <p role="status" className="rounded-md border border-line p-3 text-sm">{t('backup.reminder')} <a className="underline" href="#/data">{t('data.export')}</a> <Button type="button" variant="outline" onClick={remindLater}>{t('backup.later')}</Button></p>}
  </>;
  const cachedRemoved = safety === 'draft-target-removed' ? removedTargets.filter(target => target.kind === 'recipe' && recipes.read(target.id) && ![...document.querySelectorAll<HTMLElement>('[data-draft-kind=recipe]')].some(element => element.dataset.draftId === target.id)) : [];
  const text = safety === 'migration-backup-required' ? t('migration.required') : safety === 'storage-cleared' ? t('safety.cleared') : safety === 'draft-target-removed' ? t(cachedRemoved.length ? 'safety.cachedRemoved' : 'safety.removed') : safety === 'conflict' ? t('safety.changed') : safety === 'write-busy' ? t('safety.busy')
    : safety === 'write-unavailable' ? t('safety.unavailable') : t('safety.readFailed');
  const notice = <div role="status" className="space-y-2 rounded-md border border-amber-500/50 bg-card p-3 text-sm">
    <p>{text}</p>
    {backupAlert}
    {safety === 'migration-backup-required' && <>
      <Button type="button" variant="outline" className="whitespace-normal" onClick={() => {
        const raw = migrationSource();
        if (raw === null) return;
        try { downloadText(raw, 'menupilot-original-v1.json'); setMigrationDownload(raw); setDownloadError(false); }
        catch { setDownloadError(true); }
      }}>{t('migration.download')}</Button>
      {migrationDownload !== null && <Button type="button" variant="outline" className="whitespace-normal" onClick={async () => {
        if (await confirmMigrationDownload(migrationDownload)) setMigrationDownload(null);
      }}>{t('migration.confirm')}</Button>}
    </>}
    {safety === 'storage-cleared' && <Button type="button" variant="outline" className="whitespace-normal" onClick={async () => {
      const backup = (await exportBackup());
      if (!backup.ok) { setDownloadError(true); return; }
      try { downloadText(backup.value, 'menupilot-memory-backup.json'); recordExport(); setDownloadError(false); }
      catch { setDownloadError(true); }
    }}>{t('safety.downloadMemory')}</Button>}
    {cachedRemoved.length > 0 && <Button type="button" variant="outline" onClick={() => { cachedRemoved.forEach(target => recipes.clear(target.id)); void reloadLatest(); }}>{t('safety.discardCached')}</Button>}
    {safety === 'storage-cleared' && <Button type="button" variant="outline" className="whitespace-normal" onClick={() => { setMemoryError(null); setMemoryOpen(true); }}>{t('safety.saveMemory')}</Button>}
    {downloadError && <p role="alert">{t('data.downloadFail', { error: t('error.generic') })}</p>}
    {!['write-unavailable', 'migration-backup-required'].includes(safety) && <Button type="button" variant="outline" className="whitespace-normal" onClick={() => {
      void (safety === 'write-busy' ? activateEditing() : reloadLatest());
    }}>{safety === 'write-busy' ? t('safety.activate') : t('safety.latest')}</Button>}
  </div>;
  return <>{dialog ? createPortal(notice, dialog) : notice}
    <Dialog open={memoryOpen} onOpenChange={open => { if (commandStatus !== 'saving') setMemoryOpen(open); }}>
      <DialogContent role="alertdialog">
        <DialogHeader><DialogTitle>{t('safety.saveMemory')}</DialogTitle><DialogDescription>{t('safety.memoryConfirm')}</DialogDescription></DialogHeader>
        {memoryError && <p role="alert">{memoryError}</p>}
        <DialogFooter>
          <DialogClose asChild><Button disabled={commandStatus === 'saving'} type="button" variant="outline">{t('data.cancel')}</Button></DialogClose>
          <CommandButton type="button" onClick={async () => {
            const result = (await execute(store => store.saveMemoryAsNew(), { report: false }));
            if (result.ok) setMemoryOpen(false);
            else setMemoryError(result.error);
          }}>{t('safety.memorySave')}</CommandButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
