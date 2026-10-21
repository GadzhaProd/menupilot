import { createHistory } from './history.js';
import { createBackupStatus } from './backup.js';
import { StoreError } from './errors.js';
import { assertValidDocument } from './schema.js';
import { parseBackup, serializeBackup } from './serialization.js';
import { withWriteLock } from './writeAccess.js';
import { newId } from './ids.js';

export const STORAGE_KEY = 'menupilot:v1'; // Old clients must see version:2 and refuse it.
export const PREMIGRATION_KEY = 'menupilot:premigration-v1';
const REVISION_KEY = 'menupilot:revision';
export function writeError(error) {
  if (error instanceof StoreError) return error;
  const quota = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(error?.name) || [22, 1014].includes(error?.code);
  return new StoreError(quota ? 'quota' : 'write-failed', quota
    ? 'Browser storage is full, so the change was not saved. Export a backup and free some space.'
    : `The change could not be saved (${error?.message ?? 'unknown error'}). Your previous data is unchanged.`);
}
const publicRecord = ({ operationIds, ...record }) => structuredClone(record);

/** Browser policy and recovery capabilities are deliberately separate from StorageAdapter. */
export function createBrowserStorageAdapter(storage, { initialDocument, now = () => new Date(),
  isolated = storage?.isolated === true, locks = isolated ? undefined : globalThis.navigator?.locks ?? null, lockTimeoutMs } = {}) {
  if (typeof storage?.getItem !== 'function' || typeof storage?.setItem !== 'function') {
    throw new StoreError('bad-options', 'BrowserStorageAdapter needs storage with getItem and setItem.');
  }
  assertValidDocument(initialDocument);
  const isoNow = () => new Date(now()).toISOString();
  const history = createHistory(storage, isoNow), backup = createBackupStatus(storage, isoNow);
  let expectedRaw, expectedMarker, current = null, historyWarning = false, downloadedSource;
  const locked = work => withWriteLock(locks, work, lockTimeoutMs);
  function readRaw() {
    try { return storage.getItem(STORAGE_KEY); }
    catch (error) { throw new StoreError('read-failed', `Browser storage could not be read (${error?.message ?? 'unknown error'}).`); }
  }
  function readMarker() {
    try { return storage.getItem(REVISION_KEY); }
    catch (error) { throw new StoreError('read-failed', `Revision could not be read (${error?.message ?? 'unknown error'}).`); }
  }
  function markerNumber(marker) {
    if (marker === null || !/^\d+$/.test(marker)) return 0; // v1 UUID marker
    const n = Number(marker);
    if (!Number.isSafeInteger(n)) throw new StoreError('invalid', 'The saved revision counter is invalid.');
    return n;
  }
  function decode(raw) {
    return raw === null ? { document: structuredClone(initialDocument), revision: 0, schemaVersion: 2, documentId: null } : parseBackup(raw);
  }
  function conflict(raw, marker) {
    let latest;
    try { latest = decode(raw); } catch { /* Damaged bytes are available only through browser recovery. */ }
    return { conflict: true, revision: latest?.revision ?? markerNumber(marker), documentId: latest?.documentId ?? null,
      ...(latest && { document: structuredClone(latest.document) }) };
  }
  function protectMigration(raw) {
    if (downloadedSource === raw) return;
    try {
      if (storage.getItem(PREMIGRATION_KEY) !== raw) storage.setItem(PREMIGRATION_KEY, raw);
    } catch {
      throw new StoreError('migration-backup-required', 'The original v1 data could not be backed up in this browser. Download the original file and confirm it is saved, then retry your change. Nothing has been changed.');
    }
  }
  function commit(document, expectedRevision, opId, policy = {}) {
    if (expectedRaw === undefined) throw new StoreError('not-loaded', 'Load the saved data before writing.');
    if (typeof opId !== 'string' || !opId || opId.length > 200) throw new StoreError('invalid', 'A valid operation ID is required.');
    const raw = readRaw(), marker = readMarker();
    // Receipts are atomic with the document, so a lost response can be retried after reopening.
    let persisted;
    try { persisted = raw === expectedRaw ? current : decode(raw); } catch { /* Recovery replacement may intentionally replace damaged data. */ }
    if (persisted?.operationIds?.includes(opId)) {
      expectedRaw = raw; expectedMarker = marker; current = persisted;
      return publicRecord(current); // Replay returns the latest committed state, without another write.
    }
    if (expectedRevision !== (current?.revision ?? 0) || raw !== expectedRaw || marker !== expectedMarker) return conflict(raw, marker);
    const documentId = policy.newIdentity ? newId() : current?.documentId ?? newId();
    if (!policy.requireHistory && !policy.newIdentity && current?.documentId && JSON.stringify(document) === JSON.stringify(current.document)) return publicRecord(current);
    const migration = current?.schemaVersion === 1;
    if (migration) protectMigration(raw);
    const snapshot = history.archive(raw, policy.preservedHistoryId);
    if (policy.requireHistory && !migration && !snapshot.available) {
      throw new StoreError(snapshot.error ? writeError(snapshot.error).code : 'quota', 'A copy of the current data could not be stored. Replacement was cancelled. Export a backup and free browser storage before trying again.');
    }
    const revision = Math.max(current?.revision ?? 0, markerNumber(marker)) + 1;
    if (!Number.isSafeInteger(revision)) throw new StoreError('invalid', 'The revision counter is exhausted. Export a backup.');
    const next = { document: structuredClone(document), schemaVersion: 2, documentId, revision,
      operationIds: [...(current?.operationIds ?? []), opId].slice(-128) };
    const text = serializeBackup(next);
    for (;;) {
      try {
        storage.setItem(REVISION_KEY, String(revision)); expectedMarker = String(revision);
        storage.setItem(STORAGE_KEY, text); break;
      } catch (error) {
        const failure = writeError(error);
        if (failure.code === 'quota') {
          try { if (history.evictOldest(snapshot.protectedKey, policy.preservedHistoryId)) continue; } catch { /* Primary error wins. */ }
        }
        throw failure;
      }
    }
    expectedRaw = text; current = next; historyWarning = !snapshot.available; downloadedSource = undefined;
    try { backup.saved(policy.ownData !== false); } catch { /* Advisory metadata. */ }
    return publicRecord(next);
  }
  function transaction(document, expectedRevision, opId, policy) {
    const candidate = structuredClone(document);
    return locked(() => commit(candidate, expectedRevision, opId, policy));
  }
  const adapter = {
    async load({ beforeReplace = () => {} } = {}) {
      const raw = readRaw(), marker = readMarker();
      if (expectedRaw === undefined) { expectedRaw = raw; expectedMarker = marker; }
      const next = decode(raw);
      beforeReplace(structuredClone(next.document));
      expectedRaw = raw; expectedMarker = marker; current = next;
      return publicRecord(next);
    },
    save: (document, expectedRevision, opId = newId()) => transaction(document, expectedRevision, opId),
    importDocument: (record, expectedRevision, opId = newId()) => transaction(record.document, expectedRevision, opId,
      { requireHistory: true, newIdentity: !record.documentId || record.documentId !== current?.documentId }),
    reset: (document, expectedRevision, opId = newId(), kind = 'empty') => transaction(document, expectedRevision, opId,
      { requireHistory: true, newIdentity: true, ownData: kind !== 'demo' }),
    history: {
      async list() { return history.list().map(({ raw, ...metadata }) => metadata); },
      async read(id) {
        const entry = history.list().find(item => item.id === id);
        if (!entry) throw new StoreError('not-found', 'This version is no longer available.');
        return publicRecord(parseBackup(entry.raw, 'The saved version'));
      },
      async restore(id, expectedRevision, opId = newId()) {
        return locked(() => {
          const entry = history.list().find(item => item.id === id);
          if (!entry) throw new StoreError('not-found', 'This version is no longer available.');
          const snapshot = parseBackup(entry.raw, 'The saved version', { now: isoNow() });
          return commit(snapshot.document, expectedRevision, opId, { requireHistory: true, preservedHistoryId: id });
        });
      },
    },
    async saveMemoryAsNew(document, opId = newId()) {
      return locked(() => {
        const raw = readRaw();
        if (raw !== null) return conflict(raw, readMarker());
        expectedRaw = raw; expectedMarker = readMarker();
        return commit(document, current?.revision ?? 0, opId, { newIdentity: true });
      });
    },
    browserRecovery: {
      readRaw, getRaw: () => expectedRaw,
      async loadForRecovery() {
        try { return await adapter.load(); }
        catch (error) { expectedRaw = readRaw(); expectedMarker = readMarker(); current = null; throw error; }
      },
      migrationSource() { return current?.schemaVersion === 1 ? expectedRaw : null; },
      confirmMigrationDownload(raw) {
        if (typeof raw !== 'string' || raw !== expectedRaw || raw !== readRaw()) throw new StoreError('conflict', 'The original data changed. Download the latest original first.');
        downloadedSource = raw;
      },
    },
    browserMetadata: {
      getHistoryWarning: () => historyWarning, getBackupStatus: backup.get,
      recordExport: async () => locked(backup.exported), remindLater: async () => locked(backup.remindLater),
    },
  };
  return adapter;
}
