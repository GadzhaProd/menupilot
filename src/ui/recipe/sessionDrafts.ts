import type { CachedRecipeDraft } from './mergeDraft';

const KEY = 'menupilot.recipe-drafts.v1';
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Drafts are browser-local; authentication remains sessionStorage-only. */
function defaultDraftStorage(): DraftStorage | null {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' && typeof localStorage.setItem === 'function') return localStorage;
  } catch { /* Fall through to tab-local storage. */ }
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}
export function createRecipeDraftCache(storage: DraftStorage | null = defaultDraftStorage()) {
  const drafts = new Map<string, CachedRecipeDraft>();
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach(listener => listener());
  if (storage) {
    try {
      const saved = storage.getItem(KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const [key, value] of Object.entries(parsed)) if (value && typeof value === 'object') drafts.set(key, value as CachedRecipeDraft);
        }
      }
    } catch { /* Invalid or unavailable session storage does not block editing. */ }
  }
  const persist = () => {
    if (!storage) return;
    try { storage.setItem(KEY, JSON.stringify(Object.fromEntries(drafts))); } catch { /* The live draft remains available until navigation. */ }
  };
  return {
    read: (key: string) => drafts.get(key),
    write(key: string, draft: CachedRecipeDraft) { if (drafts.get(key) === draft) return; drafts.set(key, draft); persist(); changed(); },
    clear(key: string) { if (drafts.delete(key)) { persist(); changed(); } },
    clearAll() { if (drafts.size) { drafts.clear(); persist(); changed(); } },
    hasDrafts: () => drafts.size > 0,
    takeResumeRoute() {
      const key = drafts.keys().next().value as string | undefined;
      if (!key) return null;
      return key.startsWith('new:') ? `#/recipe/new?kind=${key.slice(4)}` : `#/recipe/${encodeURIComponent(key)}`;
    },
    targets: () => [...drafts.keys()].filter(key => !key.startsWith('new:')).map(id => ({ kind: 'recipe' as const, id })),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
