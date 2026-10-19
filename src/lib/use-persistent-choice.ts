import { useCallback, useEffect, useState } from 'react';
import type { StorageLike } from '@/ui/domain/store';
/** Preferences are separate from the menu document. Storage failures never undo an in-memory choice. */
export function usePersistentChoice<T extends string>(storage: StorageLike | null, key: string, parse: (raw: string | null) => T) {
  const [state, setState] = useState(() => {
    try { return { value: parse(storage?.getItem(key) ?? null), storageError: storage === null }; }
    catch { return { value: parse(null), storageError: true }; }
  });
  const setValue = useCallback((value: T) => {
    let storageError = false;
    try { if (!storage) throw new Error('Storage unavailable'); storage.setItem(key, value); }
    catch { storageError = true; }
    setState({ value, storageError });
  }, [storage, key]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== storage) return;
      if (event.key === key || event.key === null) setState({ value: parse(event.newValue), storageError: false });
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [storage, key, parse]);
  return { ...state, setValue };
}
