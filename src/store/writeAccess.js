import { StoreError } from './errors.js';

export const WRITE_LOCK = 'menupilot:document-writer';

/**
 * Hold an exclusive Web Lock across synchronous store commands. A lease never
 * expires by time: a suspended tab cannot accidentally keep writing after expiry.
 * The browser releases it on destruction; the UI releases it on handoff/pagehide.
 * No Web Locks means read-only, not a localStorage spinlock with a race window.
 */
export function createWriteAccess(locks, onChange = () => {}) {
  let held = false;
  let generation = 0;
  let finish = null;
  let pending = null;
  return {
    acquire() {
      if (!locks) return Promise.reject(new StoreError('write-unavailable', 'Safe saving is unavailable in this browser.'));
      if (held) return Promise.resolve();
      if (pending) return pending;
      const requestGeneration = generation;
      let ready, failed;
      const result = new Promise((resolve, reject) => { ready = resolve; failed = reject; });
      pending = result;
      locks.request(WRITE_LOCK, async () => {
        if (requestGeneration !== generation) { ready(); return; }
        held = true;
        pending = null;
        // Install release before notifying clients: they may release immediately.
        const released = new Promise(resolve => { finish = resolve; });
        onChange(true);
        ready();
        await released;
      }).catch(error => {
        if (requestGeneration === generation) pending = null;
        failed(error);
      });
      return result;
    },
    release() {
      generation += 1;
      pending = null;
      held = false;
      finish?.();
      finish = null;
      onChange(false);
    },
    assertWritable() {
      if (!locks) throw new StoreError('write-unavailable', 'Safe saving is unavailable in this browser.');
      if (!held) throw new StoreError('write-busy', 'Another tab has write access. Activate this tab and try again.');
    },
  };
}
