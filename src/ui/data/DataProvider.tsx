import {
  createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode,
} from 'react';
import { StoreError, createStore, type StorageLike, type Store } from '@/ui/domain/store';
import type { MenuDocument } from '@/ui/domain/types';
import { dataReducer, type DataState } from './reducer';

/** Commands return the new document, or `{ id, document }` when they create something. */
type CommandOutput = MenuDocument | { document: MenuDocument };

export type CommandResult<R> =
  | { ok: true; value: R }
  | { ok: false; error: string; code: string };

interface DataContextValue {
  state: DataState;
  /**
   * Run a store command OUTSIDE the reducer. On success the new document replaces the
   * one on screen; on failure the document stays as it was and the error is shown.
   */
  execute<R extends CommandOutput>(command: (store: Store) => R): CommandResult<R>;
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
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected went wrong.';
}

/** Create the store and read saved data. Reading never writes, so repeating it is harmless. */
function openStore({ storage, demo, now, createId }: Omit<DataProviderProps, 'children'>): Loaded {
  if (storage === null) {
    return {
      store: null,
      state: {
        document: null,
        commandError: null,
        loadError: 'This browser does not allow MenuPilot to keep data (storage is blocked). Try another browser or leave private mode.',
      },
    };
  }
  try {
    const store = createStore(storage, { demo, ...(now && { now }), ...(createId && { createId }) });
    return { store, state: { document: store.load(), loadError: null, commandError: null } };
  } catch (error) {
    return { store: null, state: { document: null, commandError: null, loadError: describe(error) } };
  }
}

export function DataProvider(props: DataProviderProps) {
  const { children } = props;
  // Lazy initialiser: StrictMode may call it twice, but React keeps one consistent result.
  const [loaded] = useState(() => openStore(props));
  const [state, dispatch] = useReducer(dataReducer, loaded.state);
  const { store } = loaded;

  const execute = useCallback(<R extends CommandOutput>(command: (store: Store) => R): CommandResult<R> => {
    try {
      if (store === null) {
        throw new StoreError('not-loaded', 'Data is not loaded, so nothing can be changed.');
      }
      const value = command(store);
      dispatch({ type: 'documentReplaced', document: 'document' in value ? value.document : value });
      return { ok: true, value };
    } catch (error) {
      const message = describe(error);
      dispatch({ type: 'commandFailed', message });
      return { ok: false, error: message, code: error instanceof StoreError ? error.code : 'unexpected' };
    }
  }, [store]);

  const dismissError = useCallback(() => dispatch({ type: 'errorDismissed' }), []);
  const value = useMemo(() => ({ state, execute, dismissError }), [state, execute, dismissError]);

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
export function useCommands(): Pick<DataContextValue, 'execute' | 'dismissError'> {
  const { execute, dismissError } = useData();
  return { execute, dismissError };
}
