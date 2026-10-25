import type { CachedRecipeDraft } from './mergeDraft';

const PREFIX = 'menupilot.recipe-draft.v2:';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'length' | 'key'>;
type DraftEnvelope = { key: string; savedAt: number; draft: CachedRecipeDraft };
export type RecipeDraftSummary = { key: string; name: string; route: string };

/** Recipe drafts stay on this computer for this dataset for up to seven days. Authentication remains sessionStorage-only. */
function defaultDraftStorage(): DraftStorage | null {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage.getItem === 'function' && typeof window.localStorage.setItem === 'function') return window.localStorage;
  } catch { /* Fall through to tab-local storage. */ }
  return null;
}
export function createRecipeDraftCache(storage: DraftStorage | null = defaultDraftStorage(), documentId: string | null = null, { now = Date.now }: { now?: () => number } = {}) {
  const listeners = new Set<() => void>();
  const changed = () => listeners.forEach(listener => listener());
  const scope = encodeURIComponent(documentId ?? 'unassigned');
  const prefix = `${PREFIX}${scope}:`;
  const storageKey = (key: string) => `${prefix}${encodeURIComponent(key)}`;
  function readEnvelope(key: string): DraftEnvelope | null {
    if (!storage) return null;
    const itemKey = storageKey(key);
    try {
      const raw = storage.getItem(itemKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<DraftEnvelope>;
      if (typeof value.savedAt !== 'number' || !value.draft || typeof value.draft !== 'object' || now() - value.savedAt > MAX_AGE_MS) {
        storage.removeItem(itemKey);
        return null;
      }
      return { key, savedAt: value.savedAt, draft: value.draft as CachedRecipeDraft };
    } catch { try { storage.removeItem(itemKey); } catch { /* Unavailable storage is non-fatal. */ } return null; }
  }
  const list = (): RecipeDraftSummary[] => {
    if (!storage) return [];
    const entries: RecipeDraftSummary[] = [];
    try {
      for (let index = 0; index < storage.length; index++) {
        const itemKey = storage.key(index);
        if (!itemKey?.startsWith(prefix)) continue;
        let key: string;
        try { key = decodeURIComponent(itemKey.slice(prefix.length)); } catch { storage.removeItem(itemKey); continue; }
        const entry = readEnvelope(key);
        if (entry) entries.push({ key, name: entry.draft.draft.name || key, route: routeFor(key) });
      }
    } catch { /* Storage can be disabled or filled by the browser. */ }
    return entries;
  };
  return {
    read: (key: string) => readEnvelope(key)?.draft,
    write(key: string, draft: CachedRecipeDraft) {
      try { storage?.setItem(storageKey(key), JSON.stringify({ key, savedAt: now(), draft } satisfies DraftEnvelope)); } catch { /* Keep the live form usable if storage is unavailable. */ }
      changed();
    },
    clear(key: string) { try { storage?.removeItem(storageKey(key)); } catch { /* Ignore unavailable storage. */ } changed(); },
    clearAll() {
      for (const entry of list()) try { storage?.removeItem(storageKey(entry.key)); } catch { /* Ignore unavailable storage. */ }
      changed();
    },
    list,
    hasDrafts: () => list().length > 0,
    targets: () => list().filter(entry => !entry.key.startsWith('new:')).map(entry => ({ kind: 'recipe' as const, id: entry.key })),
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

function routeFor(key: string): string {
  return key.startsWith('new:') ? `#/recipe/new?kind=${key.slice(4)}` : `#/recipe/${encodeURIComponent(key)}`;
}

export function clearAllRecipeDrafts(storage: DraftStorage | null = defaultDraftStorage()) {
  if (!storage) return;
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (key?.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch { /* Keep data commands independent of optional draft storage. */ }
}

/** True when any dataset has a live saved recipe draft, including a tab outside its editor. */
export function hasAnyRecipeDrafts(storage: DraftStorage | null = defaultDraftStorage(), now = Date.now()): boolean {
  if (!storage) return false;
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (!key?.startsWith(PREFIX)) continue;
      const raw = storage.getItem(key);
      try {
        const value = raw ? JSON.parse(raw) as Partial<DraftEnvelope> : null;
        if (value && typeof value.savedAt === 'number' && value.draft && typeof value.draft === 'object' && now - value.savedAt <= MAX_AGE_MS) return true;
      } catch { /* Remove malformed entries below. */ }
      storage.removeItem(key);
    }
  } catch { /* Optional browser storage may be unavailable. */ }
  return false;
}

/** The first successful save assigns an ID to an initially empty dataset. Keep its drafts with it. */
export function attachUnassignedRecipeDrafts(documentId: string, storage: DraftStorage | null = defaultDraftStorage()) {
  if (!storage) return;
  const oldPrefix = `${PREFIX}unassigned:`;
  const nextPrefix = `${PREFIX}${encodeURIComponent(documentId)}:`;
  try {
    for (let index = storage.length - 1; index >= 0; index--) {
      const key = storage.key(index);
      if (!key?.startsWith(oldPrefix)) continue;
      const suffix = key.slice(oldPrefix.length);
      const value = storage.getItem(key);
      if (value !== null) storage.setItem(`${nextPrefix}${suffix}`, value);
      storage.removeItem(key);
    }
  } catch { /* Optional draft storage must not block a successful data write. */ }
}
