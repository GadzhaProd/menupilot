import { StoreError } from './errors.js';

export const HISTORY_PREFIX = 'menupilot:history:';
export const HISTORY_LIMIT = 1024 * 1024;
const COUNT = 10;
const bytes = (key, value) => 2 * (key.length + value.length);
const keyFor = slot => `${HISTORY_PREFIX}${slot}`;
const safetyError = error => error instanceof StoreError && ['write-busy', 'write-unavailable'].includes(error.code);

/** Fixed slots need no index: a crash can leave an extra snapshot, never a dangling index. */
export function createHistory(storage, isoNow) {
  function slots() {
    return Array.from({ length: COUNT }, (_, slot) => {
      const key = keyFor(slot), text = storage.getItem(key);
      let entry = null;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.id === 'string' && typeof parsed.raw === 'string'
          && typeof parsed.savedAt === 'string' && Number.isFinite(Date.parse(parsed.savedAt))
          && Number.isSafeInteger(parsed.order) && parsed.order > 0) entry = parsed;
      } catch { /* An invalid slot can be reclaimed on the next save. */ }
      return { key, text, entry, size: text ? bytes(key, text) : 0 };
    });
  }
  function remove(key) {
    if (storage.removeItem) storage.removeItem(key);
    else storage.setItem(key, ''); // minimal in-memory adapters
  }
  function list() {
    return slots().filter(s => s.entry).sort((a,b) => b.entry.order - a.entry.order).map(s => s.entry);
  }
  function archive(raw) {
    if (raw === null) return { available: true, protectedKey: null };
    try {
      const all = slots();
      const ordered = all.filter(s => s.text).sort((a,b) => (a.entry?.order ?? 0) - (b.entry?.order ?? 0));
      const order = Math.max(0, ...all.map(s => s.entry?.order ?? 0)) + 1;
      const target = all.find(s => !s.text) ?? ordered[0];
      const entry = { id: crypto.randomUUID(), order, savedAt: isoNow(), raw };
      const text = JSON.stringify(entry);
      const size = bytes(target.key, text);
      if (size > HISTORY_LIMIT || !Number.isSafeInteger(order)) return { available: false, protectedKey: null };
      let total = all.reduce((sum,s) => sum+s.size, 0) - target.size;
      // Retention and quota eviction remove only automatic snapshots, oldest first.
      const victims = ordered.filter(s => s.key !== target.key);
      while (total + size > HISTORY_LIMIT && victims.length) {
        const victim = victims.shift(); remove(victim.key); total -= victim.size;
      }
      for (;;) {
        try { storage.setItem(target.key, text); return { available: true, protectedKey: target.key }; }
        catch (error) {
          if (safetyError(error)) throw error;
          const victim = victims.shift();
          if (!victim) return { available: false, protectedKey: null, error };
          remove(victim.key);
        }
      }
    } catch (error) {
      if (safetyError(error)) throw error;
      return { available: false, protectedKey: null, error };
    }
  }
  function evictOldest(protectedKey) {
    const oldest = slots().filter(s => s.text && s.key !== protectedKey)
      .sort((a,b) => (a.entry?.order ?? 0) - (b.entry?.order ?? 0))[0];
    if (!oldest) return false;
    remove(oldest.key); return true;
  }
  return { list, archive, evictOldest };
}
