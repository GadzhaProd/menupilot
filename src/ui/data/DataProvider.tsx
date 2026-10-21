import { coordinateStorage } from './browserStorage';
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
  execute<R extends CommandOutput>(command: (store: Store) => R, options?: ExecuteOptions): CommandResult<R>;
  /** The saved document as backup JSON. Read-only: it cannot change data. */
  exportBackup(): CommandResult<string>;
  dismissError(): void;
}

const DataContext = createContext<DataContextValue | null>(null);

export interface DataProviderProps {
  /** `window.localStorage`, or null when the browser does not allow it. */
  storage: StorageLike | null;
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
function openStore({ storage, demo, now, createId }: Omit<DataProviderProps, 'children'>): Loaded {
  if (storage === null) {
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
    store = createStore(storage, { demo, ...(now && { now }), ...(createId && { createId }) });
    const document = store.load();
    raw = store.getRevision() ?? null;
    return { store, raw, loadCode: null, state: { document, loadError: null, commandError: null } };
  } catch (error) {
    raw = store?.getRevision() ?? null;
    return { store, raw, loadCode: error instanceof StoreError ? error.code : 'read-failed',
      state: { document: null, commandError: null, loadError: describe(error) } };
  }
}

export function DataProvider(props: DataProviderProps) {
  return <LocaleProvider storage={props.storage}><ThemeProvider storage={props.storage}><LocalizedDataProvider {...props} /></ThemeProvider></LocaleProvider>;
}
function LocalizedDataProvider(props: DataProviderProps) {
  const { locale } = useLocale();
  return <DocumentProvider {...props} demo={isBundledDemo(props.demo) ? demoForLocale(locale) : props.demo} />;
}
function DocumentProvider(props: DataProviderProps) {
  const { children } = props;
  // Lazy initialiser: StrictMode may call it twice, but React keeps one consistent result.
  const { t } = useLocale();
  const [coordinator] = useState(() => coordinateStorage(props.storage));
  const [loaded] = useState(() => openStore({ ...props, storage: coordinator.storage }));
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

  useEffect(() => coordinator.start(), [coordinator]);

  const activateEditing = useCallback(async () => {
    try { await coordinator.activate(); setSafety(current => current === 'write-busy' ? null : current); }
    catch (error) { setSafety(error instanceof StoreError ? error.code : 'write-unavailable'); }
  }, [coordinator]);

  const reloadLatest = useCallback(async () => {
    if (!store) return;
    try {
      if (store.readRaw() === null && lastRaw.current !== null) { setSafety('storage-cleared'); return; }
      const document = store.load({ beforeReplace: next => {
        // Only a draft's own entity can unmount its editor. Unrelated deletions are safe.
        const targets: DraftTarget[] = [];
        window.document.querySelectorAll<HTMLElement>('[data-draft-kind][data-draft-id]').forEach(element => {
          const kind = element.dataset.draftKind;
          if ((kind === 'recipe' || kind === 'ingredient') && element.dataset.draftId) {
            targets.push({ kind, id: element.dataset.draftId });
          }
        });
        draftTargets.current.forEach((getTargets, source) => { if (source()) targets.push(...getTargets()); });
        if (targets.some(target => !(target.kind === 'recipe' ? next.recipes : next.ingredients).some(item => item.id === target.id))) {
          throw new Error('draft-target-removed');
        }
      } });
      lastRaw.current = store.getRevision() ?? null;
      dispatch({ type: 'documentReplaced', document });
      setSafety(null);
      await activateEditing();
    } catch (error) {
      if (error instanceof Error && error.message === 'draft-target-removed') { setSafety('draft-target-removed'); return; }
      // A failed load deliberately does not advance a live store's CAS token. Open a
      // recovery store against the damaged bytes so a confirmed restore can replace them.
      const latest = openStore({ ...props, storage: coordinator.storage });
      setStore(latest.store); setRecoveryRaw(latest.raw); setLoadCode(latest.loadCode);
      lastRaw.current = latest.raw;
      if (latest.state.document) dispatch({ type: 'documentReplaced', document: latest.state.document });
      else dispatch({ type: 'loadFailed', message: latest.state.loadError! });
      setSafety(null);
    }
  }, [store, activateEditing, props.demo, props.now, props.createId, coordinator]);

  useEffect(() => {
    function changed(event?: StorageEvent) {
      if (event && (event.key !== null && event.key !== STORAGE_KEY)) return;
      if (event?.storageArea && event.storageArea !== props.storage) return;
      if (!store || state.loadError) return;
      try {
        const hasDrafts = [...draftSources.current].some(source => source()) || !!document.querySelector('form, [role="dialog"], [role="alertdialog"]');
        const raw = store.readRaw();
        if (raw === lastRaw.current) {
          if (!hasDrafts) setSafety(current => current && ['conflict', 'draft-target-removed', 'write-busy'].includes(current) ? null : current);
          return;
        }
        if (raw === null && lastRaw.current !== null) { setSafety('storage-cleared'); return; }
        // A mounted form is conservative protection, including an untouched editor.
        if (hasDrafts) {
          setSafety('conflict');
        } else {
          const document = store.load();
          lastRaw.current = store.getRevision() ?? null;
          dispatch({ type: 'documentReplaced', document });
          setSafety(null);
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
  }, [store, props.storage, state.loadError]);

  const execute = useCallback(<R extends CommandOutput>(
    command: (store: Store) => R,
    { report = true }: ExecuteOptions = {},
  ): CommandResult<R> => {
    try {
      if (store === null) {
        throw new StoreError('not-loaded', 'Data is not loaded, so nothing can be changed.');
      }
      const value = command(store);
      lastRaw.current = store.getRevision() ?? null;
      setSafety(null);
      dispatch({ type: 'documentReplaced', document: 'document' in value ? value.document : value });
      return { ok: true, value };
    } catch (error) {
      const code = error instanceof StoreError ? String(error.code) : 'unexpected';
      const special = ['conflict', 'write-busy', 'write-unavailable'].includes(code);
      const message = code === 'conflict' ? t('safety.changed')
        : code === 'write-busy' ? t('safety.busy')
          : code === 'write-unavailable' ? t('safety.unavailable') : describe(error);
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
    }
  }, [store, t]);

  const exportBackup = useCallback((): CommandResult<string> => {
    try {
      if (state.document === null) {
        throw new StoreError('not-loaded', 'Data is not loaded, so nothing can be read.');
      }
      return { ok: true, value: JSON.stringify(state.document, null, 2) };
    } catch (error) {
      return {
        ok: false,
        error: describe(error),
        code: error instanceof StoreError ? error.code : 'unexpected',
        details: error instanceof StoreError ? error.details : [],
      };
    }
  }, [state.document]);

  const dismissError = useCallback(() => dispatch({ type: 'errorDismissed' }), []);
  const value = useMemo(() => ({ state, execute, exportBackup, dismissError, safety, reloadLatest,
    activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode }),
  [state, execute, exportBackup, dismissError, safety, reloadLatest, activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode]);

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
export function useCommands(): Pick<DataContextValue, 'execute' | 'exportBackup' | 'dismissError'> {
  const { execute, exportBackup, dismissError } = useData();
  return { execute, exportBackup, dismissError };
}

/** Recovery and cross-tab controls; form command signatures remain synchronous. */
export function useDataSafety() {
  const { safety, reloadLatest, activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode } = useData();
  return { safety, reloadLatest, activateEditing, registerDraftSource, draftsChanged, recoveryRaw, loadCode };
}
