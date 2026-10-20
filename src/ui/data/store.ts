import type { MenuDocument } from '@/ui/domain/types';
import { createStore, type Store } from '@/ui/domain/store';

/** Concurrency metadata belongs to persistence, never to the serialized domain document. */
export interface SynchronizedStore extends Store {
  load(options?: { beforeReplace?: (document: MenuDocument) => void }): MenuDocument;
  getRevision(): string | null | undefined;
}

export function createSynchronizedStore(...args: Parameters<typeof createStore>): SynchronizedStore {
  return createStore(...args) as SynchronizedStore;
}
