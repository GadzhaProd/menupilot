import { StoreError } from './errors.js';

// Same name as v1 leases: old and new tabs cannot enter a critical section together.
export const WRITE_LOCK = 'menupilot:document-writer';

/** One lock per complete CAS/history/write transaction; never a timer or a spinlock. */
export async function withWriteLock(locks, work) {
  if (locks === null) throw new StoreError('write-unavailable', 'Safe saving is unavailable in this browser.');
  return locks ? locks.request(WRITE_LOCK, work) : work();
}
