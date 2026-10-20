import { createSynchronizedStore, type SynchronizedStore } from './store';
import { coordinateStorage } from './browserStorage';
import { LocaleProvider, useLocale } from '@/ui/i18n';
import { ThemeProvider } from '@/ui/theme/ThemeProvider';
import { demoForLocale, isBundledDemo } from './demo';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode,
} from 'react';
import { StoreError, STORAGE_KEY, type StorageLike, type Store } from '@/ui/domain/store';
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

interface DataContextValue {
  state: DataState;
  safety: string | null;
  reloadLatest(): Promise<void>;
  activateEditing(): Promise<void>;
  hasDrafts: { current: () => boolean };
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
  store: SynchronizedStore | null;
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
  let store: SynchronizedStore | null = null;
  let raw: string | null = null;
  try {
    store = createSynchronizedStore(storage, { demo, ...(now && { now }), ...(createId && { createId }) });
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
  const hasDrafts = useRef<() => boolean>(() => false);
  const lastRaw = useRef(loaded.raw);
  const [state, dispatch] = useReducer(dataReducer, loaded.state);
  const { store } = loaded;

  useEffect(() => coordinator.start(), [coordinator]);

  const activateEditing = useCallback(async () => {
    try { await coordinator.activate(); setSafety(current => current === 'write-busy' ? null : current); }
    catch { setSafety('write-unavailable'); }
  }, [coordinator]);

  const reloadLatest = useCallback(async () => {
    if (!store) return;
    try {
      const document = store.load({ beforeReplace: next => {
        const previous = state.document;
        if (!previous || !window.document.querySelector('form, [role="dialog"], [role="alertdialog"]')) return;
        // Existing editors unmount when their entity disappears. Refuse that refresh
        // before advancing the store's token; the user can copy/cancel their draft first.
        const missing = <T extends { readonly id: string }>(before: readonly T[], after: readonly T[]) =>
          before.some(item => !after.some(other => other.id === item.id));
        const removed = missing(previous.ingredients, next.ingredients) || missing(previous.recipes, next.recipes);
        if (removed) throw new Error('draft-target-removed');
      } });
      lastRaw.current = store.getRevision() ?? null;
      dispatch({ type: 'documentReplaced', document });
      setSafety(null);
      await activateEditing();
    } catch (error) { setSafety(error instanceof Error && error.message === 'draft-target-removed' ? 'draft-target-removed' : 'read-failed'); }
  }, [store, activateEditing, state.document]);

  useEffect(() => {
    function changed(event?: StorageEvent) {
      if (event && (event.key !== null && event.key !== STORAGE_KEY)) return;
      if (event?.storageArea && event.storageArea !== props.storage) return;
      if (!store) return;
      try {
        if (store.readRaw() === lastRaw.current) return;
        // Treat a mounted editing form/dialog as an in-progress draft, even before
        // its first keystroke. Existing local drafts must never be silently rebased.
        if (hasDrafts.current() || document.querySelector('form, [role="dialog"], [role="alertdialog"]')) {
          setSafety('conflict');
        } else {
          const document = store.load();
          lastRaw.current = store.getRevision() ?? null;
          dispatch({ type: 'documentReplaced', document });
          setSafety(null);
        }
      } catch { setSafety('read-failed'); }
    }
    const focus = () => changed();
    window.addEventListener('storage', changed);
    window.addEventListener('focus', focus);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', focus); };
  }, [store, props.storage]);

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
      if (store === null) {
        throw new StoreError('not-loaded', 'Data is not loaded, so nothing can be read.');
      }
      return { ok: true, value: store.exportJSON() };
    } catch (error) {
      return {
        ok: false,
        error: describe(error),
        code: error instanceof StoreError ? error.code : 'unexpected',
        details: error instanceof StoreError ? error.details : [],
      };
    }
  }, [store]);

  const dismissError = useCallback(() => dispatch({ type: 'errorDismissed' }), []);
  const value = useMemo(() => ({ state, execute, exportBackup, dismissError, safety, reloadLatest,
    activateEditing, hasDrafts, recoveryRaw: loaded.raw, loadCode: loaded.loadCode }),
  [state, execute, exportBackup, dismissError, safety, reloadLatest, activateEditing, loaded]);

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
  const { safety, reloadLatest, activateEditing, hasDrafts, recoveryRaw, loadCode } = useData();
  return { safety, reloadLatest, activateEditing, hasDrafts, recoveryRaw, loadCode };
}
