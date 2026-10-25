import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/i18n';
import { createRecipeDraftCache } from './sessionDrafts';
const Context = createContext<ReturnType<typeof createRecipeDraftCache> | null>(null);
export function RecipeDraftProvider({ children, documentId }: { children: ReactNode; documentId: string | null }) {
  const cache = useMemo(() => createRecipeDraftCache(undefined, documentId), [documentId]);
  return <Context.Provider value={cache}>{children}</Context.Provider>;
}
export function RecipeDraftNotice() {
  const cache = useRecipeDrafts();
  const { t } = useLocale();
  const [drafts, setDrafts] = useState(cache.list);
  useEffect(() => {
    const refresh = () => setDrafts(cache.list());
    const unsubscribe = cache.subscribe(refresh);
    window.addEventListener('storage', refresh);
    return () => { unsubscribe(); window.removeEventListener('storage', refresh); };
  }, [cache]);
  if (!drafts.length) return null;
  return <aside role="status" className="rounded-md border border-primary/40 bg-card p-3 text-sm">
    <p>{t('local.draftAvailable', { name: drafts[0]!.name.startsWith('new:') ? t(drafts[0]!.name === 'new:dish' ? 'recipe.newDish' : 'recipe.newPrep') : drafts[0]!.name })}</p>
    <div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => { window.location.hash = drafts[0]!.route; }}>{t('local.draftOpen')}</Button>
      <Button type="button" variant="ghost" onClick={() => cache.clear(drafts[0]!.key)}>{t('local.draftDelete')}</Button>
    </div>
  </aside>;
}

/** Isolated screens can omit the app cache. */
export function useRecipeDrafts() {
  const value = useContext(Context);
  const local = useMemo(() => value ? null : createRecipeDraftCache(), [value]);
  return value ?? local!;
}
