import { useLocale } from '@/ui/i18n';
import { demoForLocale } from '@/ui/data/demo';
import { useRef, useState, type ChangeEvent } from 'react';
import { DownloadIcon, FilePlusIcon, RotateCcwIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

function successText(done: Pending): string {
  if (done.kind === 'import') return `Backup ${done.fileName} was imported. Your data is replaced.`;
  return done.kind === 'empty' ? 'All data was removed. Start by adding ingredients on the Ingredients page.' : 'Demo data restored.';
}

function dialogText(pending: Pending) {
  if (pending.kind === 'import') {
    return { title: 'Import this backup?', description: `File: ${pending.fileName}.`, confirmLabel: 'Replace with backup' };
  }
  if (pending.kind === 'empty') {
    return {
      title: 'Start with empty data?',
      description: 'Ingredients, prices, recipes and saved scenarios are all removed. Export a backup first if you want to keep them.',
      confirmLabel: 'Start with empty data',
    };
  }
  return { title: 'Reset to demo data?', description: 'The fictional demo restaurant is loaded.', confirmLabel: 'Reset to demo data' };
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
  const { locale } = useLocale();
  const document = useDocument();
  const { execute, exportBackup: readBackupText } = useCommands();
  const sessions = useSimulatorSessions();
  const dialog = useDialogState<Pending>();
  const fileInput = useRef<HTMLInputElement>(null);
  const openImport = useRef<HTMLButtonElement>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  function downloadBackup() {
    const result = readBackupText();
    if (!result.ok) {
      setNotice({ tone: 'error', text: `The backup could not be created. ${result.error}` });
      return;
    }
    const fileName = backupFileName(new Date());
    try {
      downloadText(result.value, fileName);
    } catch (error) {
      setNotice({ tone: 'error', text: `The backup could not be downloaded (${error instanceof Error ? error.message : 'unknown error'}).` });
      return;
    }
    setNotice({ tone: 'ok', text: `Backup saved as ${fileName}. Keep it somewhere safe.` });
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = ''; // choosing the same file again must work
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setNotice({ tone: 'error', text: `${file.name} is too large for a backup (limit 5 MB). Your current data was not changed.` });
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setNotice({ tone: 'error', text: `${file.name} could not be read. Your current data was not changed.` });
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
    if (!result.ok) return result.error;
    sessions.clear();
    dialog.close();
    setNotice({ tone: 'ok', text: successText(pending) });
    return null;
  }

  const unsaved = sessions.unsavedTotal();

  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-1">
        <h1 id="page-title" className="text-2xl font-semibold">Data</h1>
        <p className="text-sm text-muted-foreground">
          Your data lives only in this browser. Export a backup regularly.
        </p>
        <p className="text-sm text-muted-foreground">
          Now: {document.ingredients.length} ingredients, {document.recipes.length} recipes, {document.scenarios.length} saved scenarios.
        </p>
        <HelpLink section="data" />
      </div>

      {notice !== null ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={notice.tone === 'error'
            ? 'rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive'
            : 'rounded-md border border-border bg-secondary/60 p-3 text-sm'}
        >
          {notice.text}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Export backup</CardTitle>
          <CardDescription>Download all ingredients, prices, recipes and saved scenarios as one JSON file.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={downloadBackup}><DownloadIcon aria-hidden="true" /> Export backup</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import backup</CardTitle>
          <CardDescription>Restore from a MenuPilot backup file. This replaces all current data. A file that cannot be used is rejected and nothing changes.</CardDescription>
        </CardHeader>
        <CardContent>
          <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Backup file" className="hidden" onChange={chooseFile} />
          <Button ref={openImport} type="button" variant="outline" onClick={() => fileInput.current?.click()}>
            <UploadIcon aria-hidden="true" /> Import backup
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset to demo data</CardTitle>
          <CardDescription>Replace everything with the fictional demo restaurant. Export a backup first if you want to keep your data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={(event) => dialog.open({ kind: 'reset' }, event)}>
            <RotateCcwIcon aria-hidden="true" /> Reset to demo data
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Start with empty data</CardTitle>
          <CardDescription>Remove everything, including the demo restaurant, and start with a blank page. Export a backup first if you want to keep your data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={(event) => dialog.open({ kind: 'empty' }, event)}>
            <FilePlusIcon aria-hidden="true" /> Start with empty data
          </Button>
        </CardContent>
      </Card>

      {dialog.state !== null ? (
        <ReplaceDataDialog
          {...dialogText(dialog.state)}
          unsavedScenarios={unsaved}
          onClose={dialog.close}
          onCloseAutoFocus={dialog.onCloseAutoFocus}
          onConfirm={confirm}
        />
      ) : null}
    </section>
  );
}
