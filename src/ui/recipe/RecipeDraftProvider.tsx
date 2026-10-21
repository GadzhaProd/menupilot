import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createRecipeDraftCache } from './sessionDrafts';
const Context = createContext<ReturnType<typeof createRecipeDraftCache> | null>(null);
export function RecipeDraftProvider({ children }: { children: ReactNode }) {
  const [cache] = useState(createRecipeDraftCache);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (cache.hasDrafts()) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [cache]);
  return <Context.Provider value={cache}>{children}</Context.Provider>;
}
/** Isolated screens can omit the app cache. */
export function useRecipeDrafts() {
  const value = useContext(Context);
  const [local] = useState(createRecipeDraftCache);
  return value ?? local;
}
