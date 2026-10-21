import { StoreError } from './errors.js';
export const WRITE_LOCK = 'menupilot:document-writer';
export const WRITE_WAIT_MS = 5000;

/** Abort only acquisition, never an already-running transaction. */
export async function withWriteLock(locks, work, timeoutMs = WRITE_WAIT_MS) {
  if (locks === null) throw new StoreError('write-unavailable', 'Safe saving is unavailable in this browser.');
  if (!locks) return work(); // Explicitly isolated in-memory adapter.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await locks.request(WRITE_LOCK, { signal: controller.signal }, () => {
      clearTimeout(timer);
      return work();
    });
  } catch (error) {
    if (controller.signal.aborted && error?.name === 'AbortError') {
      throw new StoreError('write-busy', 'Another tab is still saving. Nothing was changed. You can close this dialog or try saving again.');
    }
    throw error;
  } finally { clearTimeout(timer); }
}
