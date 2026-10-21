import type { StorageLike } from '@/ui/domain/store';

/** Tests explicitly mark their storage as isolated; every other storage requires Web Locks. */
export function browserLocks(storage: StorageLike | null): LockManager | null | undefined {
  return storage?.isolated ? undefined : navigator.locks ?? null;
}
