import { useLocale } from '@/ui/i18n';
import { demoForLocale } from '@/ui/data/demo';
import { useRef, useState, type ChangeEvent } from 'react';
import { DownloadIcon, FilePlusIcon, RotateCcwIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { InlineStatus } from '@/components/ui/inline-status';
import { useCommands, useDocument } from '@/ui/data/DataProvider';
import { ReplaceDataDialog } from '@/ui/data/ReplaceDataDialog';
import { HelpLink } from '@/ui/help/HelpLink';
import { useDialogState } from '@/ui/hooks/useDialogState';
import { useSimulatorSessions } from '@/ui/simulator/session';

/** Same limit as the store: a backup is about the size of the whole browser storage quota. */
const MAX_FILE_BYTES = 5_000_000;

type Pending = { kind: 'import'; fileName: string; text: string } | { kind: 'reset' } | { kind: 'empty' };

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
      description: t('data.confirmEmptyDescription'),
      confirmLabel: t('data.confirmEmptyAction'),
    };
  }
  return { title: t('data.confirmDemo'), description: t('data.confirmDemoDescription'), confirmLabel: t('data.reset') };
}

function downloadText(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.append(link);
  link.click();
  link.remove();
  // Revoke later: revoking right after click() can cancel the download in Firefox.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Back up, restore and reset the data. Everything lives in this browser, so a backup matters. */
export function DataPage() {
  const { locale, t } = useLocale();
  const document = useDocument();
  const { execute, exportBackup: readBackupText } = useCommands();
  const sessions = useSimulatorSessions();
  const dialog = useDialogState<Pending>();
  const fileInput = useRef<HTMLInputElement>(null);
  const openImport = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function commandError(code: string, message: string, details: readonly string[]): string {
    if (locale === 'en') return [message, ...details, t('data.currentDataUnchanged')].filter(Boolean).join(' ');
    if (code === 'invalid') return t('data.error.invalid');
    if (code === 'corrupt-json') return t('data.error.corruptJson');
    if (code === 'unsupported-version') return t('data.error.version');
    if (code === 'quota') return t('data.error.quota');
    if (code === 'write-failed') return t('data.error.write');
    if (code === 'in-use') return t('data.error.inUse');
    return t('error.generic');
  }

  function downloadBackup() {
    const result = readBackupText();
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
    setNotice(null);
    dialog.open({ kind: 'import', fileName: file.name, text }, { currentTarget: openImport.current ?? input });
  }

  function confirm(): string | null {
    const pending = dialog.state;
    if (pending === null) return null;
    const result = pending.kind === 'import'
      ? execute((store) => store.importJSON(pending.text), { report: false })
      : pending.kind === 'empty'
        ? execute((store) => store.resetToEmpty(), { report: false })
        : execute((store) => store.resetToDemo(demoForLocale(locale)), { report: false });
    if (!result.ok) return commandError(result.code, result.error, result.details);
    sessions.clear();
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
        <p className="max-w-prose text-muted-foreground">{t('data.intro')}</p>
        <p className="text-sm text-muted-foreground">{t('data.currentCounts', { ingredients: document.ingredients.length, recipes: document.recipes.length, scenarios: document.scenarios.length })}</p>
        <HelpLink section="data" />
      </div>

      {notice !== null ? (
        <InlineStatus tone={notice.tone === 'error' ? 'error' : 'success'}>{notice.text}</InlineStatus>
      ) : null}

      <Surface aria-labelledby="export-title" className="space-y-4"><div className="space-y-1"><h2 id="export-title" className="text-xl font-semibold">{t('data.exportTitle')}</h2><p className="text-muted-foreground">{t('data.exportDescription')}</p></div><Button type="button" onClick={downloadBackup}><DownloadIcon aria-hidden="true" /> {t('data.export')}</Button></Surface>

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
          unsavedScenarios={unsaved}
          onClose={dialog.close}
          onCloseAutoFocus={dialog.onCloseAutoFocus}
          onConfirm={confirm}
        />
      ) : null}
    </section>
  );
}
