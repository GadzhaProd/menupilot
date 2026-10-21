import type { CachedRecipeDraft } from './mergeDraft';

/** A cache belongs to one mounted app, never to another tab or a later app mount. */
export function createRecipeDraftCache() {
  const drafts = new Map<string, CachedRecipeDraft>();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach(listener => listener());
  return {
    read: (key: string) => drafts.get(key),
    write(key: string, draft: CachedRecipeDraft) { if (drafts.get(key) === draft) return; drafts.set(key, draft); changed(); },
    clear(key: string) { if (drafts.delete(key)) changed(); },
    clearAll() { if (drafts.size) { drafts.clear(); changed(); } },
    hasDrafts: () => drafts.size > 0,
    targets: () => [...drafts.keys()].filter(key => !key.startsWith('new:')).map(id => ({ kind: 'recipe' as const, id })),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
