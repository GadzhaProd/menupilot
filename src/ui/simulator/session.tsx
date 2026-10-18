/**
 * Scenario drafts that are not saved yet, kept in memory for the length of the visit so that
 * leaving a dish and coming back does not lose them. Nothing here goes to localStorage or the
 * store: closing the tab drops it, and a "leave this page?" warning says so while something is unsaved.
 */
import {
  createContext, useContext, useEffect, useMemo, useRef, type ReactNode,
} from 'react';
import { isUnsaved, type ScenarioDraft } from './scenarios';

/** Everything the simulator screen of one dish holds in its local state. */
export interface DishSession {
  drafts: ScenarioDraft[];
  volumeText: string;
  sharedVolume: number | undefined;
  volumeError: string | undefined;
}

export interface SimulatorSessions {
  get(dishId: string): DishSession | undefined;
  set(dishId: string, session: DishSession): void;
  /** Number of scenarios of the dish with changes that are not saved. */
  unsavedCount(dishId: string): number;
  /** Unsaved scenarios across all dishes. */
  unsavedTotal(): number;
  /** Forget every draft (the data was replaced, so drafts of the old data no longer fit). */
  clear(): void;
}

const SessionContext = createContext<SimulatorSessions | null>(null);

const unsavedIn = (session: DishSession | undefined) => (session ? session.drafts.filter(isUnsaved).length : 0);

export function SimulatorSessionProvider({ children }: { children: ReactNode }) {
  const sessions = useRef(new Map<string, DishSession>());
  const api = useMemo<SimulatorSessions>(() => ({
    get: (dishId) => sessions.current.get(dishId),
    set: (dishId, session) => { sessions.current.set(dishId, session); },
    unsavedCount: (dishId) => unsavedIn(sessions.current.get(dishId)),
    unsavedTotal: () => [...sessions.current.values()].reduce((sum, session) => sum + unsavedIn(session), 0),
    clear: () => { sessions.current.clear(); },
  }), []);

  // Closing or reloading the tab would lose unsaved scenarios: ask first.
  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if ([...sessions.current.values()].some((session) => unsavedIn(session) > 0)) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

/** Without a provider (a screen rendered alone) drafts are simply not remembered. */
const NO_MEMORY: SimulatorSessions = {
  get: () => undefined, set: () => {}, unsavedCount: () => 0, unsavedTotal: () => 0, clear: () => {},
};

export function useSimulatorSessions(): SimulatorSessions {
  return useContext(SessionContext) ?? NO_MEMORY;
}

/** Remember the screen's state whenever it changes. */
export function useRememberSession(dishId: string, session: DishSession) {
  const sessions = useSimulatorSessions();
  useEffect(() => { sessions.set(dishId, session); }, [sessions, dishId, session]);
}
