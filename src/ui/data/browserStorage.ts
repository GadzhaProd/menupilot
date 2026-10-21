import type { StorageLike } from '@/ui/domain/store';

/** Only the browser adapter needs Web Locks. In-memory storage is already isolated. */
export function browserLocks(storage: StorageLike | null): LockManager | null | undefined {
  try { if (storage === window.localStorage) return navigator.locks ?? null; }
  catch { /* Storage access was denied; opening the store will report the read failure. */ }
  return undefined;
}
