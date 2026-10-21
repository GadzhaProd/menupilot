import { createHttpStorageAdapter } from '@/store/httpAdapter.js';
import { readLocalConfig, loadLocalConfig, LocalModeContext, type LocalConfig, type ConnectionState } from './localMode';
import { browserLocks } from './browserStorage';
import type { HistoryEntry, BackupStatus } from '@/ui/domain/store';
import type { StorageAdapter } from '@/ui/domain/storageAdapter';
import { LocaleProvider, useLocale } from '@/ui/i18n';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { demoForLocale, isBundledDemo } from './demo';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode,
} from 'react';
import { StoreError, createStore, STORAGE_KEY, type StorageLike, type Store } from '@/ui/domain/store';
import type { MenuDocument } from '@/ui/domain/types';
import { dataReducer, type DataState } from './reducer';

/** Commands return the new document, or `{ id, document }` when they create something. */
type CommandOutput = MenuDocument | { document: MenuDocument };

export type CommandResult<R> =
  | { ok: true; value: R }
  | { ok: false; error: string; code: string; details: readonly string[] };

export interface ExecuteOptions {
  /**
   * Show a failure in the banner at the top of the page (default). A form that shows the
   * error next to its own Save button passes `false` to avoid saying it twice.
   */
  report?: boolean;
}

export type DraftTarget = { kind: 'ingredient' | 'recipe'; id: string };

interface DataContextValue {
  state: DataState;
  safety: string | null;
  removedTargets: readonly DraftTarget[];
  historyWarning: boolean;
  backupStatus: BackupStatus;
  readHistory(id: string): Promise<CommandResult<MenuDocument>>;
  previewImport(text: string): Promise<CommandResult<MenuDocument>>;
  migrationSource(): string | null;
  confirmMigrationDownload(raw: string): Promise<boolean>;
  listHistory(): Promise<CommandResult<readonly HistoryEntry[]>>;
  recordExport(): Promise<void>;
  remindLater(): Promise<void>;
  backupError: string | null;
  reloadLatest(): Promise<void>;
  activateEditing(): Promise<void>;
  registerDraftSource(source: () => boolean, targets?: () => readonly DraftTarget[]): () => void;
  draftsChanged(): void;
  recoveryRaw: string | null;
  loadCode: string | null;
  /**
   * Run a store command OUTSIDE the reducer. On success the new document replaces the
   * one on screen; on failure the document stays as it was and the error is shown.
   */
  execute<R extends CommandOutput>(command: (store: Store) => Promise<R>, options?: ExecuteOptions): Promise<CommandResult<R>>;
  commandStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  /** The saved document as backup JSON. Read-only: it cannot change data. */
  exportBackup(): Promise<CommandResult<string>>;
  dismissError(): void;
}

const DataContext = createContext<DataContextValue | null>(null);

export interface DataProviderProps {
  /** `window.localStorage`, or null when the browser does not allow it. */
  storage: StorageLike | null;
  adapter?: StorageAdapter;
  /** The parsed data/demo.json. */
  demo: unknown;
  now?: () => Date | number | string;
  createId?: (prefix: string) => string;
  children: ReactNode;
}

interface Loaded {
  store: Store | null;
  state: DataState;
  raw: string | null;
  loadCode: string | null;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected went wrong.';
}

/** Create the store and read saved data. Reading never writes, so repeating it is harmless. */
async function openStore({ storage, demo, now, createId, adapter }: Omit<DataProviderProps, 'children'>): Promise<Loaded> {
  if (storage === null && !adapter) {
    return {
      store: null, raw: null, loadCode: 'read-failed',
      state: {
        document: null,
        commandError: null,
        loadError: 'This browser does not allow MenuPilot to keep data (storage is blocked). Try another browser or leave private mode.',
      },
    };
  }
  let store: Store | null = null;
  let raw: string | null = null;
  try {
    const locks = browserLocks(storage);
    store = createStore(storage!, { demo, adapter, locks, ...(now && { now }), ...(createId && { createId }) });
    const document = await store.load({ recovery: true });
    raw = store.browserRecovery?.getRaw() ?? null;
    return { store, raw, loadCode: null, state: { document, loadError: null, commandError: null } };
  } catch (error) {
    raw = store?.browserRecovery?.getRaw() ?? null;
    return { store, raw, loadCode: error instanceof StoreError ? error.code : 'read-failed',
      state: { document: null, commandError: null, loadError: describe(error) } };
  }
}

export function DataProvider(props: DataProviderProps) {
  const [connection, setConnection] = useState<ConnectionState>(null);
  const [runtime, setRuntime] = useState<{ config: LocalConfig | null; error: string | null; loading: boolean }>(() => {
    if (document.querySelector('meta[name="menupilot-mode"]') && !document.getElementById('menupilot-local-config')) return { config: null, error: null, loading: true };
    try { return { config: readLocalConfig(), error: null, loading: false }; }
    catch (error) { return { config: null, error: describe(error), loading: false }; }
  });
  useEffect(() => {
    if (!runtime.loading) return;
    let active = true;
    void loadLocalConfig().then(config => { if (active) setRuntime({ config, error: null, loading: false }); },
      error => { if (active) setRuntime({ config: null, error: describe(error), loading: false }); });
    return () => { active = false; };
  }, [runtime.loading]);
  const adapter = useMemo(() => runtime.config
    ? createHttpStorageAdapter({ token: runtime.config.token, onConnectionChange: setConnection })
    : props.adapter, [runtime.config, props.adapter]);
  if (runtime.loading) return <p role="status">Loading MenuPilot… / MenuPilot laden…</p>;
  if (runtime.error) return <main role="alert" className="mx-auto max-w-3xl space-y-4 p-6">
    <h1 className="text-2xl font-semibold">MenuPilot</h1><p>{runtime.error}</p>
    <p lang="nl">Ongeldige configuratie van de lokale server. Start MenuPilot opnieuw en vernieuw deze pagina.</p>
  </main>;
  return <LocalModeContext.Provider value={runtime.config ? { dataDir: runtime.config.dataDir, connection } : null}>
    <LocaleProvider storage={props.storage}><ThemeProvider storage={props.storage}><LocalizedDataProvider {...props} adapter={adapter} /></ThemeProvider></LocaleProvider>
  </LocalModeContext.Provider>;
}
function LocalizedDataProvider(props: DataProviderProps) {
  const { locale } = useLocale();
  return <DocumentProvider {...props} demo={isBundledDemo(props.demo) ? demoForLocale(locale) : props.demo} />;
}
function DocumentProvider(props: DataProviderProps) {
  const { children } = props;
  // Read in an effect; ignore results from the discarded StrictMode mount.
  const { t } = useLocale();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let active = true;
    void openStore(props).then(value => { if (active) setLoaded(value); });
    return () => { active = false; };
  }, []);
  if (!loaded) return <p role="status">{t('commands.loading')}</p>;
  return <ReadyDataProvider {...props} loaded={loaded}>{children}</ReadyDataProvider>;
}
function ReadyDataProvider(props: DataProviderProps & { loaded: Loaded }) {
  const { children, loaded } = props;
  const { t } = useLocale();
  const pending = useRef(false);
  const routeEpoch = useRef(0);
  useEffect(() => {
    const changed = () => { routeEpoch.current++; setCommandStatus(status => status === 'saving' ? status : 'idle'); };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  const [commandStatus, setCommandStatus] = useState<DataContextValue['commandStatus']>('idle');
  useEffect(() => {
    if (commandStatus !== 'saved') return;
    const timer = setTimeout(() => setCommandStatus('idle'), 3000);
    return () => clearTimeout(timer);
  }, [commandStatus]);
  const [removedTargets, setRemovedTargets] = useState<readonly DraftTarget[]>([]);
  const [historyWarning, setHistoryWarning] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus>(() => loaded.store?.getBackupStatus() ?? { startedAt: null, lastExportAt: null, due: false });
  const [safety, setSafety] = useState<string | null>(null);
  const draftSources = useRef(new Set<() => boolean>());
  const draftTargets = useRef(new Map<() => boolean, () => readonly DraftTarget[]>());
  const recheck = useRef<() => void>(() => {});
  const draftsChanged = useCallback(() => { queueMicrotask(() => recheck.current()); }, []);
  const registerDraftSource = useCallback((source: () => boolean, targets?: () => readonly DraftTarget[]) => {
    draftSources.current.add(source);
    if (targets) draftTargets.current.set(source, targets);
    return () => { draftSources.current.delete(source); draftTargets.current.delete(source); draftsChanged(); };
  }, [draftsChanged]);
  const lastRaw = useRef(loaded.raw);
  const [state, dispatch] = useReducer(dataReducer, loaded.state);
  const [store, setStore] = useState(loaded.store);
  const [recoveryRaw, setRecoveryRaw] = useState(loaded.raw);
  const [loadCode, setLoadCode] = useState(loaded.loadCode);


  const activateEditing = useCallback(async () => {
    // Locks belong to individual adapter writes; there is no tab-wide lease now.
    setSafety(current => current === 'write-busy' ? null : current);
  }, []);

  const reloadLatest = useCallback(async () => {
    if (!store || pending.current) return;
    pending.current = true;
    try {
      if (store.browserRecovery && store.browserRecovery.readRaw() === null && lastRaw.current !== null) { setSafety('storage-cleared'); return; }
      const document = await store.load({ beforeReplace: next => {
        // Only a draft's own entity can unmount its editor. Unrelated deletions are safe.
        const targets: DraftTarget[] = [];
        window.document.querySelectorAll<HTMLElement>('[data-draft-kind][data-draft-id]').forEach(element => {
          const kind = element.dataset.draftKind;
          if ((kind === 'recipe' || kind === 'ingredient') && element.dataset.draftId) {
            targets.push({ kind, id: element.dataset.draftId });
          }
        });
        draftTargets.current.forEach((getTargets, source) => { if (source()) targets.push(...getTargets()); });
        const missing = targets.filter(target => !(target.kind === 'recipe' ? next.recipes : next.ingredients).some(item => item.id === target.id));
        if (missing.length) {
          setRemovedTargets(missing);
          throw new Error('draft-target-removed');
        }
      } });
      lastRaw.current = store.browserRecovery?.getRaw() ?? null;
      dispatch({ type: 'documentReplaced', document });
      setSafety(null);
      await activateEditing();
    } catch (error) {
      if (error instanceof Error && error.message === 'draft-target-removed') { setSafety('draft-target-removed'); return; }
      if (props.adapter) { setSafety('read-failed'); return; }
      // A failed load deliberately does not advance a live store's CAS token. Open a
      // recovery store against the damaged bytes so a confirmed restore can replace them.
      const latest = await openStore(props);
      setStore(latest.store); setRecoveryRaw(latest.raw); setLoadCode(latest.loadCode);
      lastRaw.current = latest.raw;
      if (latest.state.document) dispatch({ type: 'documentReplaced', document: latest.state.document });
      else dispatch({ type: 'loadFailed', message: latest.state.loadError! });
      setSafety(null);
    } finally { pending.current = false; }
  }, [store, activateEditing, props.demo, props.now, props.createId]);

  useEffect(() => {
    async function changed(event?: StorageEvent) {
      if (event && (event.key !== null && event.key !== STORAGE_KEY)) return;
      if (event?.storageArea && event.storageArea !== props.storage) return;
      if (!store?.browserRecovery || state.loadError || pending.current) return;
      try {
        const hasDrafts = [...draftSources.current].some(source => source()) || !!document.querySelector('form, [role="dialog"], [role="alertdialog"]');
        const raw = store.browserRecovery?.readRaw();
        if (raw === lastRaw.current) {
          if (!hasDrafts) setSafety(current => current && ['conflict', 'draft-target-removed', 'write-busy'].includes(current) ? null : current);
          return;
        }
        if (raw === null && lastRaw.current !== null) { setSafety('storage-cleared'); return; }
        // A mounted form is conservative protection, including an untouched editor.
        if (hasDrafts) {
          setSafety('conflict');
        } else {
          pending.current = true;
          try {
            const document = await store.load();
            lastRaw.current = store.browserRecovery?.getRaw() ?? null;
            dispatch({ type: 'documentReplaced', document });
            setSafety(null);
          } finally { pending.current = false; }
        }
      } catch { setSafety('read-failed'); }
    }
    recheck.current = changed;
    const focus = () => changed();
    // Recheck after Cancel/close, but not on unrelated text mutations from a notice.
    const forms = () => [...document.querySelectorAll('form, [role="dialog"], [role="alertdialog"]')];
    let previous = forms();
    const observer = new MutationObserver(() => {
      const next = forms();
      if (previous.length !== next.length || previous.some((item, index) => item !== next[index])) {
        previous = next; changed();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', changed);
    window.addEventListener('focus', focus);
    return () => {
      observer.disconnect(); recheck.current = () => {};
      window.removeEventListener('storage', changed); window.removeEventListener('focus', focus);
    };
    // D/C can push an invalidation from their transport without changing screens.
  }, [store, props.storage, state.loadError, reloadLatest]);
  useEffect(() => props.adapter?.subscribe?.(() => {
    if ([...draftSources.current].some(source => source()) || document.querySelector('form, [role="dialog"], [role="alertdialog"]')) setSafety('conflict');
    else void reloadLatest();
  }), [props.adapter, reloadLatest]);

  const execute = useCallback(async <R extends CommandOutput>(
    command: (store: Store) => Promise<R>,
    { report = true }: ExecuteOptions = {},
  ): Promise<CommandResult<R>> => {
    if (pending.current) return { ok: false, code: 'write-busy', error: t('commands.busy'), details: [] };
    pending.current = true;
    const startedAtRoute = routeEpoch.current;
    setCommandStatus('saving');
    try {
      if (store === null) {
        throw new StoreError('not-loaded', 'Data is not loaded, so nothing can be changed.');
      }
      const value = await command(store);
      lastRaw.current = store.browserRecovery?.getRaw() ?? null;
      setSafety(null);
      setHistoryWarning(store.getHistoryWarning());
      setBackupStatus(store.getBackupStatus());
      dispatch({ type: 'documentReplaced', document: 'document' in value ? value.document : value });
      setCommandStatus(routeEpoch.current === startedAtRoute ? 'saved' : 'idle');
      return { ok: true, value };
    } catch (error) {
      const code = error instanceof StoreError ? String(error.code) : 'unexpected';
      const special = ['conflict', 'write-busy', 'write-unavailable', 'migration-backup-required'].includes(code);
      const message = code === 'conflict' ? t('safety.changed')
        : code === 'write-busy' ? t('safety.busy')
          : code === 'write-unavailable' ? t('safety.unavailable') : code === 'migration-backup-required' ? t('migration.required') : describe(error);
      setCommandStatus(code === 'conflict' ? 'conflict' : 'error');
      if (special) setSafety(code);
      if (report && !special) {
        dispatch({ type: 'commandFailed', message });
      }
      return {
        ok: false,
        error: message,
        code: error instanceof StoreError ? error.code : 'unexpected',
        details: error instanceof StoreError ? error.details : [],
      };
    } finally { pending.current = false; }
  }, [store, t]);

  const exportBackup = useCallback(async (): Promise<CommandResult<string>> => {
    try {
      if (state.document === null) {
        throw new StoreError('not-loaded', 'Data is not loaded, so nothing can be read.');
      }
      return { ok: true, value: await store!.exportJSON() };
    } catch (error) {
      return {
        ok: false,
        error: describe(error),
        code: error instanceof StoreError ? error.code : 'unexpected',
        details: error instanceof StoreError ? error.details : [],
      };
    }
  }, [state.document, store]);

  const listHistory = useCallback(async (): Promise<CommandResult<readonly HistoryEntry[]>> => {
    try { return { ok: true, value: await store?.listHistory() ?? [] }; }
    catch { return { ok: false, code: 'read-failed', error: t('history.unavailable'), details: [] }; }
  }, [store, t]);
  const readHistory = useCallback(async (id: string): Promise<CommandResult<MenuDocument>> => {
    try { return { ok: true, value: (await store!.readHistory(id)).document }; }
    catch { return { ok: false, code: 'invalid', error: t('history.invalid'), details: [] }; }
  }, [store, t]);
  const previewImport = useCallback(async (text: string): Promise<CommandResult<MenuDocument>> => {
    try { return { ok: true, value: store!.previewImport(text) }; }
    catch (error) { return { ok: false, code: error instanceof StoreError ? error.code : 'invalid', error: describe(error), details: [] }; }
  }, [store]);
  const migrationSource = useCallback(() => store?.browserRecovery?.migrationSource() ?? null, [store]);
  const confirmMigrationDownload = useCallback(async (raw: string) => {
    try { store?.browserRecovery?.confirmMigrationDownload(raw); setSafety(null); setCommandStatus('idle'); return true; }
    catch { setSafety('conflict'); return false; }
  }, [store]);
  const recordExport = useCallback(async () => {
    try { await store?.recordExport(); if (store) setBackupStatus(store.getBackupStatus()); setBackupError(null); }
    catch { setBackupError(t('backup.recordFailed')); }
  }, [store, t]);
  const remindLater = useCallback(async () => {
    try { await store?.remindLater(); if (store) setBackupStatus(store.getBackupStatus()); setBackupError(null); }
    catch { setBackupError(t('backup.deferFailed')); }
  }, [store, t]);
  useEffect(() => {
    const refresh = () => { if (store) setBackupStatus(store.getBackupStatus()); };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh); };
  }, [store]);
  const dismissError = useCallback(() => dispatch({ type: 'errorDismissed' }), []);
  const value = useMemo(() => ({ commandStatus, removedTargets, historyWarning, backupStatus, backupError, remindLater, listHistory, readHistory, previewImport, migrationSource, confirmMigrationDownload, recordExport, state, execute, exportBackup, dismissError, safety, reloadLatest,
    activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode }),
  [commandStatus, removedTargets, historyWarning, backupStatus, backupError, remindLater, listHistory, readHistory, previewImport, migrationSource, confirmMigrationDownload, recordExport, state, execute, exportBackup, dismissError, safety, reloadLatest, activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (value === null) {
    throw new Error('Data hooks must be used inside <DataProvider>.');
  }
  return value;
}

/** Current data, load error and last command error. */
export function useDataState(): DataState {
  return useData().state;
}

/** The document on screen; throws if the saved data could not be opened (check `loadError` first). */
export function useDocument(): MenuDocument {
  const { document } = useData().state;
  if (document === null) {
    throw new Error('No document: the saved data could not be opened.');
  }
  return document;
}

/** Stable command runner and error dismissal. */
export function useCommands(): Pick<DataContextValue, 'execute' | 'exportBackup' | 'dismissError' | 'commandStatus' | 'previewImport'> {
  const { execute, exportBackup, dismissError, commandStatus, previewImport } = useData();
  return { execute, exportBackup, dismissError, commandStatus, previewImport };
}

/** Recovery and cross-tab controls. */
export function useDataSafety() {
  const { safety, removedTargets, reloadLatest, activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode, migrationSource, confirmMigrationDownload } = useData();
  return { safety, removedTargets, reloadLatest, activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode, migrationSource, confirmMigrationDownload };
}

export function useVersionHistory() {
  const { historyWarning, backupStatus, backupError, remindLater, listHistory, readHistory, recordExport } = useData();
  return { historyWarning, backupStatus, backupError, remindLater, listHistory, readHistory, recordExport };
}
