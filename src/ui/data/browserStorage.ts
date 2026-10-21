import { createWriteAccess } from '@/store/writeAccess.js';
import { StoreError, type StorageLike } from '@/ui/domain/store';

/** In-memory adapters are already serialized by their JS runtime; only native storage crosses tabs. */
interface BrowserSurfaces {
  window: Pick<Window, 'localStorage' | 'addEventListener' | 'removeEventListener'>;
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  locks: LockManager | null;
  BroadcastChannel: typeof BroadcastChannel | undefined;
}
export function coordinateStorage(storage: StorageLike | null, surfaces: BrowserSurfaces = {
  window, document, locks: navigator.locks ?? null,
  BroadcastChannel: typeof BroadcastChannel === 'undefined' ? undefined : BroadcastChannel,
}) {
  const { window, document, locks, BroadcastChannel: Channel } = surfaces;
  let native = false;
  try { native = storage !== null && storage === window.localStorage; } catch { /* blocked */ }
  let held = false;
  const access = native ? createWriteAccess(locks, value => { held = value; }) : null;
  let channel: BroadcastChannel | null = null;
  let pending: Promise<void> | null = null;
  const activate = (): Promise<void> => {
    if (!access) return Promise.resolve();
    if (document.visibilityState !== 'visible') {
      release();
      return Promise.reject(new StoreError('write-busy', 'Activate this tab before saving.'));
    }
    if (held) return Promise.resolve();
    if (pending) return pending;
    channel?.postMessage('request-writer');
    const request = access.acquire();
    pending = request;
    void request.finally(() => { if (pending === request) pending = null; }).catch(() => {});
    return request;
  };
  const release = () => { access?.release(); pending = null; };
  return {
    storage: storage && access ? {
      getItem: (key: string) => storage.getItem(key),
      setItem(key: string, value: string) { access.assertWritable(); storage.setItem(key, value); },
    } : storage,
    activate,
    start() {
      if (!access) return () => {};
      if (Channel) {
        channel = new Channel('menupilot:writer-handoff');
        channel.onmessage = event => { if (event.data === 'request-writer') release(); };
      }
      // Acquire in advance so existing synchronous form commands retain their contract.
      const request = () => { void activate().catch(() => {}); };
      const visibility = () => { if (document.visibilityState === 'hidden') release(); else request(); };
      request();
      window.addEventListener('focus', request);
      window.addEventListener('blur', release);
      document.addEventListener('pointerdown', request, true);
      document.addEventListener('keydown', request, true);
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('pagehide', release);
      window.addEventListener('pageshow', request);
      return () => {
        window.removeEventListener('focus', request);
        window.removeEventListener('blur', release);
        document.removeEventListener('pointerdown', request, true);
        document.removeEventListener('keydown', request, true);
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('pagehide', release);
        window.removeEventListener('pageshow', request);
        release(); channel?.close(); channel = null;
      };
    },
  };
}
