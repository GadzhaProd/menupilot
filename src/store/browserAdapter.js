import { createHistory } from './history.js';
import { createBackupStatus } from './backup.js';
import { StoreError } from './errors.js';
import { assertValidDocument } from './schema.js';
import { parseBackup, serializeBackup } from './serialization.js';
import { withWriteLock } from './writeAccess.js';

export const STORAGE_KEY = 'menupilot:v1'; // Keep the key: old clients must see version:2 and refuse it.
const REVISION_KEY = 'menupilot:revision';
export function writeError(error) {
  if (error instanceof StoreError) return error;
  const quota = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name) || [22, 1014].includes(error?.code);
  return new StoreError(quota ? 'quota' : 'write-failed', quota
    ? 'Browser storage is full, so the change was not saved. Export a backup and free some space.'
    : `The change could not be saved (${error?.message ?? 'unknown error'}). Your previous data is unchanged.`);
}

/**
 * Async StorageAdapter. Inject locks for native localStorage; null means fail closed.
 * Omitted locks is only for isolated, in-memory storage (synchronous critical section).
 * load never writes: a legacy upgrade is committed with the first explicit command.
 */
function nativeLocks(storage) {
  try { if (typeof window !== 'undefined' && storage === window.localStorage) return globalThis.navigator?.locks ?? null; }
  catch { /* load will report inaccessible storage */ }
  return undefined;
}

export function createBrowserStorageAdapter(storage, { initialDocument, now = () => new Date(), locks = nativeLocks(storage) } = {}) {
  if (typeof storage?.getItem !== 'function' || typeof storage?.setItem !== 'function') {
    throw new StoreError('bad-options', 'BrowserStorageAdapter needs storage with getItem and setItem.');
  }
  assertValidDocument(initialDocument);
  const isoNow = () => new Date(now()).toISOString();
  const history = createHistory(storage, isoNow), backup = createBackupStatus(storage, isoNow);
  let expectedRaw, expectedMarker, current = null, historyWarning = false;
  const initialId = crypto.randomUUID();
  const locked = work => withWriteLock(locks, work);
  function readRaw() {
    try { return storage.getItem(STORAGE_KEY); }
    catch (error) { throw new StoreError('read-failed', `Browser storage could not be read (${error?.message ?? 'unknown error'}).`); }
  }
  function readMarker() {
    try { return storage.getItem(REVISION_KEY); }
    catch (error) { throw new StoreError('read-failed', `Revision could not be read (${error?.message ?? 'unknown error'}).`); }
  }
  function markerNumber(marker) {
    // Pre-v2 markers were UUIDs. A v2 counter never rolls back, including failed commits.
    if (marker === null || !/^\d+$/.test(marker)) return 0;
    const n = Number(marker);
    if (!Number.isSafeInteger(n)) throw new StoreError('invalid', 'The saved revision counter is invalid.');
    return n;
  }
  function capture() {
    const raw = readRaw(), marker = readMarker();
    if (expectedRaw === undefined) { expectedRaw = raw; expectedMarker = marker; }
    return { raw, marker };
  }
  function decode(raw) {
    const result = raw === null ? { document: structuredClone(initialDocument), revision: 0, schemaVersion: 2, documentId: initialId }
      : parseBackup(raw);
    return { ...result, documentId: result.documentId ?? initialId };
  }
  function commit(document, expectedRevision, options = {}) {
    if (expectedRaw === undefined) throw new StoreError('not-loaded', 'Load the saved data before writing.');
    assertValidDocument(document, options.checkFuture ? { now: isoNow() } : undefined);
    const { raw, marker } = capture();
    if (expectedRevision !== (current?.revision ?? 0) || raw !== expectedRaw || marker !== expectedMarker) {
      throw new StoreError('conflict', 'Another tab changed the saved data. Load the latest data, review your draft and save again.');
    }
    const documentId = options.documentId ?? current?.documentId ?? initialId;
    if (!options.force && current?.schemaVersion === 2 && raw !== null
      && JSON.stringify(document) === JSON.stringify(current.document) && documentId === current.documentId) return structuredClone(current);
    const snapshot = history.archive(raw, options.preservedHistoryId);
    // Migration is a destructive format change; always retain the exact v1 source first.
    if ((options.requireHistory || current?.schemaVersion === 1) && !snapshot.available) {
      throw new StoreError(snapshot.error ? writeError(snapshot.error).code : 'quota', `The change could not be saved: a copy of the current data could not be stored${snapshot.error?.message ? ` (${snapshot.error.message})` : ''}. Your previous data is unchanged. Replacement was cancelled. Export a backup and free browser storage before trying again.`);
    }
    const revision = Math.max(current?.revision ?? 0, markerNumber(marker)) + 1;
    if (!Number.isSafeInteger(revision)) throw new StoreError('invalid', 'The revision counter is exhausted. Export a backup.');
    const next = { document: structuredClone(document), schemaVersion: 2, documentId, revision };
    const text = serializeBackup(next);
    for (;;) {
      try {
        storage.setItem(REVISION_KEY, String(revision));
        expectedMarker = String(revision);
        storage.setItem(STORAGE_KEY, text);
        break;
      } catch (error) {
        const failure = writeError(error);
        if (failure.code === 'quota') {
          try { if (history.evictOldest(snapshot.protectedKey, options.preservedHistoryId)) continue; }
          catch { /* Preserve the primary failure. */ }
        }
        throw failure;
      }
    }
    expectedRaw = text; current = next; historyWarning = !snapshot.available;
    try { backup.saved(options.ownData !== false); } catch { /* advisory metadata */ }
    return structuredClone(next);
  }
  const adapter = {
    async load({ beforeReplace = () => {}, recovery = false } = {}) {
      const { raw, marker } = capture();
      let next;
      try { next = decode(raw); }
      catch (error) {
        // Explicitly starting recovery is distinct from a failed live reload.
        // This also supports a supplied adapter reused by a new recovery store.
        if (recovery) { expectedRaw = raw; expectedMarker = marker; current = null; }
        throw error;
      }
      beforeReplace(structuredClone(next.document));
      expectedRaw = raw; expectedMarker = marker; current = next;
      return structuredClone(next);
    },
    async save(document, expectedRevision, options) {
      const candidate = structuredClone(document);
      return locked(() => commit(candidate, expectedRevision, options));
    },
    history: {
      async list() { return history.list(); },
      async read(id) {
        const entry = history.list().find(item => item.id === id);
        if (!entry) throw new StoreError('not-found', 'This version is no longer available.');
        return parseBackup(entry.raw, 'The saved version', { now: isoNow() });
      },
      async restore(id, expectedRevision) {
        return locked(() => {
          const entry = history.list().find(item => item.id === id);
          if (!entry) throw new StoreError('not-found', 'This version is no longer available.');
          const snapshot = parseBackup(entry.raw, 'The saved version', { now: isoNow() });
          return commit(snapshot.document, expectedRevision, { force: true, requireHistory: true, preservedHistoryId: id });
        });
      },
    },
    async exportBackup() {
      if (!current) throw new StoreError('not-loaded', 'Data is not loaded.');
      return serializeBackup(current, true);
    },
    async importBackup(text, expectedRevision) {
      const imported = parseBackup(text, 'The imported file', { now: isoNow() });
      return adapter.save(imported.document, expectedRevision, { force: true, requireHistory: true,
        documentId: imported.documentId ?? crypto.randomUUID() });
    },
    async saveMemoryAsNew(document) {
      return locked(() => {
        if (readRaw() !== null) throw new StoreError('conflict', 'Another tab has saved data. Load the latest data first.');
        expectedRaw = null; expectedMarker = readMarker();
        return commit(document, current?.revision ?? 0, { force: true, documentId: crypto.randomUUID() });
      });
    },
    readRaw,
    getRaw: () => expectedRaw,
    getHistoryWarning: () => historyWarning,
    getBackupStatus: backup.get,
    recordExport: async () => locked(backup.exported),
    remindLater: async () => locked(backup.remindLater),
  };
  return adapter;
}
