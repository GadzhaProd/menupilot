import { useLocalMode } from '@/ui/data/localMode';
import type { MenuDocument } from '@/ui/domain/types';
import { VersionHistory } from '@/ui/data/VersionHistory';
import { useVersionHistory } from '@/ui/data/DataProvider';
import { isSafetyError } from '@/ui/data/safetyErrors';
import { useRecipeDrafts } from '@/ui/recipe/RecipeDraftProvider';
import { downloadText } from '@/ui/data/downloadText';
import { useLocale } from '@/ui/i18n';
import { demoForLocale } from '@/ui/data/demo';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { DownloadIcon, FilePlusIcon, RotateCcwIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { InlineStatus } from '@/components/ui/inline-status';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import { ReplaceDataDialog } from '@/ui/data/ReplaceDataDialog';
import { HelpLink } from '@/ui/help/HelpLink';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useSimulatorSessions } from '@/ui/simulator/session';
import { localizedImportError } from '@/ui/data/importErrors';

/** Same limit as the store: a backup is about the size of the whole browser storage quota. */
const MAX_FILE_BYTES = 5_000_000;

type Pending = { kind: 'import'; fileName: string; text: string; preview: MenuDocument } | { kind: 'reset' } | { kind: 'empty' };

const pad = (value: number) => String(value).padStart(2, '0');

export function backupFileName(date: Date): string {
  return `menupilot-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

function dialogText(pending: Pending, t: ReturnType<typeof useLocale>['t']) {
  if (pending.kind === 'import') {
    return { title: t('data.confirmImport'), description: t('data.file', { file: pending.fileName }), confirmLabel: t('data.replaceBackup') };
  }
  if (pending.kind === 'empty') {
    return {
      title: t('data.confirmEmpty'),
      description: t('data.emptyHistoryDescription'),
      confirmLabel: t('data.confirmEmptyAction'),
    };
  }
  return { title: t('data.confirmDemo'), description: t('data.confirmDemoDescription'), confirmLabel: t('data.reset') };
}

/** Back up, restore and reset the data. Everything lives in this browser, so a backup matters. */
export function DataPage() {
  const { locale, t, plural } = useLocale();
  const document = useDocument();
  const local = useLocalMode();
  const { backupStatus, recordExport } = useVersionHistory();
  const { execute, previewImport, exportBackup: readBackupText } = useCommands();
  const sessions = useSimulatorSessions();
  const recipes = useRecipeDrafts();
  const dialog = useDialogState<Pending>();
  const fileInput = useRef<HTMLInputElement>(null);
  const openImport = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string; details?: readonly string[] } | null>(null);
  const priorLocale = useRef(locale);
  useEffect(() => {
    if (priorLocale.current !== locale) { priorLocale.current = locale; setNotice(null); }
  }, [locale]);

  function commandError(code: string, message: string, details: readonly string[]): string {
    if (locale === 'en') return [message, ...details, t('data.currentDataUnchanged')].filter(Boolean).join(' ');
    if (code === 'invalid') return t('data.error.invalid', { detail: details[0] ?? message });
    if (code === 'corrupt-json') return t('data.error.corruptJson');
    if (code === 'unsupported-version') return t('data.error.version');
    if (code === 'quota') return t('data.error.quota');
    if (code === 'write-failed') return t('data.error.write');
    if (code === 'in-use') return t('data.error.inUse');
    return t('error.generic');
  }

  async function downloadBackup() {
    const result = await readBackupText();
    if (!result.ok) {
      setNotice({ tone: 'error', text: t('data.exportFail', { error: commandError(result.code, result.error, result.details) }) });
      return;
    }
    const fileName = backupFileName(new Date());
    try {
      downloadText(result.value, fileName);
    } catch (error) {
      setNotice({ tone: 'error', text: t('data.downloadFail', { error: t('error.generic') }) });
      return;
    }
    await recordExport();
    setNotice({ tone: 'ok', text: t('data.backupSaved', { file: fileName }) });
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // choosing the same file again must work
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setNotice({ tone: 'error', text: t('data.fileTooLarge', { file: file.name }) });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ tone: 'error', text: t('data.fileUnreadable', { file: file.name }) });
      return;
    }
    const result = await previewImport(text);
    if (!result.ok) {
      setNotice({ tone: 'error', text: localizedImportError(t, result.code, result.details, result.structuredDetails), details: result.details.length ? result.details : [result.error] });
      return;
    }
    setNotice(null);
    dialog.open({ kind: 'import', fileName: file.name, text, preview: result.value }, { currentTarget: openImport.current ?? input });
  }

  async function confirm(): Promise<{ message: string; details?: readonly string[] } | null> {
    const pending = dialog.state;
    if (pending === null) return null;
    const result = pending.kind === 'import'
      ? (await execute((store) => store.importJSON(pending.text), { report: false, clearRecipeDrafts: true }))
      : pending.kind === 'empty'
        ? (await execute((store) => store.resetToEmpty(), { report: false, clearRecipeDrafts: true }))
        : (await execute((store) => store.resetToDemo(demoForLocale(locale)), { report: false, clearRecipeDrafts: true, resetDemoNotice: true }));
    if (!result.ok) {
      if (isSafetyError(result.code)) return null;
      if (pending.kind === 'import') return {
        message: localizedImportError(t, result.code, result.details, result.structuredDetails),
        details: result.details.length ? result.details : [result.error],
      };
      return { message: commandError(result.code, result.error, result.details) };
    }
    sessions.clear(); recipes.clearAll();
    dialog.close();
    setNotice({ tone: 'ok', text: pending.kind === 'import'
      ? t('data.importSuccess', { file: pending.fileName })
      : pending.kind === 'empty' ? t('data.emptySuccess') : t('data.demoSuccess') });
    return null;
  }

  const unsaved = sessions.unsavedTotal();

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-4xl font-semibold">{t('data.title')}</h1>
        <p className="max-w-prose text-muted-foreground">{local ? (locale === 'nl' ? 'Je gegevens staan op deze computer. MenuPilot bewaart hier automatisch kopieën; de status staat bovenaan.' : 'Your data is stored on this computer. MenuPilot saves local copies automatically; see their status above.') : t('data.intro')}</p>
        <p className="text-sm text-muted-foreground">{t('data.currentCounts', {
          ingredients: plural('data.count.ingredients', document.ingredients.length),
          recipes: plural('data.count.recipes', document.recipes.length),
          scenarios: plural('data.count.scenarios', document.scenarios.length),
        })}</p>
        <HelpLink section="data" />
      </div>

      {notice !== null ? (
        <InlineStatus tone={notice.tone === 'error' ? 'error' : 'success'}>
          <p>{notice.text}</p>
          {notice.tone === 'error' && notice.details?.length ? <details className="mt-2 text-xs">
            <summary className="cursor-pointer">{t('data.importError.details')}</summary>
            <pre className="mt-1 whitespace-pre-wrap break-words">{notice.details.join('\n')}</pre>
          </details> : null}
        </InlineStatus>
      ) : null}

      <Surface aria-labelledby="export-title" className="space-y-4"><div className="space-y-1"><h2 id="export-title" className="text-xl font-semibold">{t('data.exportTitle')}</h2><p className="text-muted-foreground">{t('data.exportDescription')}</p></div><Button type="button" onClick={downloadBackup}><DownloadIcon aria-hidden="true" /> {t('data.export')}</Button></Surface>

      {!local && <p className="text-sm text-muted-foreground">{backupStatus.lastExportAt ? t('backup.lastExport', { date: new Date(backupStatus.lastExportAt).toLocaleString(locale === 'nl' ? 'nl-NL' : 'en-GB') }) : t('backup.never')}</p>}
      <VersionHistory />
      <Surface aria-labelledby="import-title" className="space-y-4">
          <div className="space-y-1"><h2 id="import-title" className="text-xl font-semibold">{t('data.importTitle')}</h2><p className="text-muted-foreground">{t('data.importDescription')}</p></div>
          <input ref={fileInput} type="file" accept=".json,application/json" aria-label={t('data.backupFile')} className="hidden" onChange={chooseFile} />
          <Button ref={openImport} type="button" variant="outline" onClick={() => fileInput.current?.click()}>
            <UploadIcon aria-hidden="true" /> {t('data.import')}
          </Button>
      </Surface>

      <Surface aria-labelledby="reset-title" className="space-y-4">
          <div className="space-y-1"><h2 id="reset-title" className="text-xl font-semibold">{t('data.resetTitle')}</h2><p className="text-muted-foreground">{t('data.resetDescription')}</p></div>
          <Button type="button" variant="outline" onClick={(event) => dialog.open({ kind: 'reset' }, event)}>
            <RotateCcwIcon aria-hidden="true" /> {t('data.reset')}
          </Button>
      </Surface>

      <Surface aria-labelledby="empty-title" className="space-y-4">
          <div className="space-y-1"><h2 id="empty-title" className="text-xl font-semibold">{t('data.emptyTitle')}</h2><p className="text-muted-foreground">{t('data.emptyDescription')}</p></div>
          <Button type="button" variant="outline" onClick={(event) => dialog.open({ kind: 'empty' }, event)}>
            <FilePlusIcon aria-hidden="true" /> {t('data.startEmpty')}
          </Button>
      </Surface>

      {dialog.state !== null ? (
        <ReplaceDataDialog
          {...dialogText(dialog.state, t)}
          preview={dialog.state.kind === 'import' ? <div className="space-y-2 text-sm">
            <p>{t('data.previewContent')}: {plural('count.dishes', dialog.state.preview.recipes.filter(r => r.kind === 'dish').length)} · {plural('count.preps', dialog.state.preview.recipes.filter(r => r.kind === 'prep').length)} · {plural('count.ingredients', dialog.state.preview.ingredients.length)} · {plural('count.scenarios', dialog.state.preview.scenarios.length)}</p>
            <p>{t('data.importWarning')}</p>
          </div> : undefined}
          unsavedScenarios={unsaved}
          onClose={dialog.close}
          onCloseAutoFocus={dialog.onCloseAutoFocus}
          onConfirm={confirm}
        />
      ) : null}
    </section>
  );
}
