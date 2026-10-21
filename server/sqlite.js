import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { StoreError } from '../src/store/errors.js';
import { assertValidDocument, emptyDocument } from '../src/store/schema.js';
import { assertValidTransition } from '../src/store/transitions.js';
import { parseBackup, serializeBackup } from '../src/store/serialization.js';
import { createRemoteAdapter } from '../src/store/remoteAdapter.js';

export const DB_VERSION = 1;
export const BUDGETS = { history: { count: 32, bytes: 64 * 1024 * 1024 },
  ops: { count: 4096, bytes: 4 * 1024 * 1024 }, journal: { count: 10000, bytes: 4 * 1024 * 1024 } };
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
function digest(value) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
const invalid = message => { throw new StoreError('invalid', message); };

/** Owned by one server process. Each adapter has its own last accepted CAS identity. */
export function createSqliteStorage(path, { initialDocument = emptyDocument(), now = () => new Date() } = {}) {
  assertValidDocument(initialDocument);
  const db = new DatabaseSync(path);
  try {
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version !== 0 && version !== DB_VERSION) throw new StoreError('unsupported-version', 'This database needs a newer MenuPilot.');
    db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA wal_autocheckpoint=1000;');
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS document (id INTEGER PRIMARY KEY CHECK(id=1), record TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, savedAt TEXT NOT NULL, raw TEXT NOT NULL, bytes INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ops (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, receipt TEXT NOT NULL, bytes INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS journal (seq INTEGER PRIMARY KEY AUTOINCREMENT, entry TEXT NOT NULL, bytes INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS plans (id TEXT PRIMARY KEY, expiresAt TEXT NOT NULL, plan TEXT NOT NULL);
      PRAGMA user_version=1; COMMIT;`);
  } catch (error) { db.close(); throw error; }
  // The initial empty document is deterministic across restarts, and is not a write.
  const initial = { document: structuredClone(initialDocument), schemaVersion: 2, documentId: null, revision: 0 };
  function decodeRecord(raw) {
    let record;
    try { record = JSON.parse(raw); } catch { throw new StoreError('corrupt-json', 'The saved database record is invalid JSON.'); }
    if (record?.documentId === null && record.schemaVersion === 2 && record.revision === 0) {
      assertValidDocument(record.document);
      return record;
    }
    return parseBackup(JSON.stringify({ version: 2, ...record }));
  }
  const version = () => {
    const row = db.prepare("SELECT json_extract(record, '$.documentId') AS documentId, json_extract(record, '$.revision') AS revision FROM document WHERE id=1").get();
    return row ? { ...row } : { documentId: null, revision: 0 };
  };
  const load = () => {
    const raw = db.prepare('SELECT record FROM document WHERE id=1').get()?.record;
    return raw ? decodeRecord(raw) : structuredClone(initial);
  };
  function readHistory(id) {
    const row = db.prepare('SELECT raw FROM history WHERE id=?').get(id);
    if (!row) throw new StoreError('not-found', 'This version is no longer available.');
    return decodeRecord(row.raw);
  }
  function prune(table) {
    const budget = BUDGETS[table];
    // Keep newest first; never evict the snapshot just created for a replacement.
    const rows = db.prepare(`SELECT seq, bytes FROM ${table} ORDER BY seq DESC`).all();
    let bytes = 0;
    for (let i = 0; i < rows.length; i++) {
      bytes += rows[i].bytes;
      if (i >= budget.count || bytes > budget.bytes) db.prepare(`DELETE FROM ${table} WHERE seq=?`).run(rows[i].seq);
    }
  }
  function write(input, actor = 'ui') {
    if (!input || !['save', 'import', 'reset', 'restore', 'memory'].includes(input.kind)) invalid('Unknown write operation.');
    const fields = { save: ['document'], import: ['source'], reset: ['document', 'resetKind'], restore: ['id'], memory: ['document'] };
    const allowed = ['kind', 'expectedDocumentId', 'expectedRevision', 'opId', ...fields[input.kind]];
    if (Object.keys(input).some(key => input[key] !== undefined && !allowed.includes(key))) invalid('Unknown command field.');
    if (input.kind === 'import') {
      const source = input.source;
      if (!source || ![1, 2].includes(source.schemaVersion) || !Number.isSafeInteger(source.revision) || source.revision < 0 ||
        !(source.documentId === null || (typeof source.documentId === 'string' && source.documentId.length > 0 && source.documentId.length <= 200)) ||
        Object.keys(source).some(key => !['document', 'schemaVersion', 'documentId', 'revision'].includes(key))) invalid('Invalid import metadata.');
    }
    if (!['ui', 'cli'].includes(actor)) invalid('Unknown operation source.');
    if (typeof input.opId !== 'string' || !input.opId || input.opId.length > 200) invalid('A valid operation ID is required.');
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 ||
      !(input.expectedDocumentId === null || typeof input.expectedDocumentId === 'string')) invalid('Invalid CAS metadata.');
    // Identity is the adapter's observed precondition, not command content: a newly
    // opened adapter may already see the identity produced by this very operation.
    const { expectedDocumentId, ...command } = input;
    const hash = digest({ command, actor });
    try {
      db.exec('BEGIN IMMEDIATE');
      const current = load();
      const matches = current.documentId === expectedDocumentId && current.revision === input.expectedRevision;
      const old = db.prepare('SELECT hash, receipt FROM ops WHERE id=?').get(input.opId);
      if (old) {
        if (old.hash !== hash) throw new StoreError('op-id-reused', 'This operation ID was already used for different content.');
        db.exec('COMMIT');
        return { ...current, receipt: JSON.parse(old.receipt) };
      }
      if (!matches || (input.kind === 'memory' && current.documentId !== null)) {
        db.exec('ROLLBACK'); return { ...current, conflict: true };
      }
      if (input.kind === 'reset' && !['empty', 'demo'].includes(input.resetKind)) invalid('Invalid reset kind.');
      const document = input.kind === 'restore' ? readHistory(input.id).document
        : input.kind === 'import' ? input.source?.document : input.document;
      assertValidDocument(document, { now: now() });
      if (input.kind === 'save') assertValidTransition(current.document, document);
      const newIdentity = ['reset', 'memory'].includes(input.kind) ||
        (input.kind === 'import' && (!input.source.documentId || input.source.documentId !== current.documentId));
      const unchanged = input.kind === 'save' && current.documentId !== null && digest(document) === digest(current.document);
      const next = unchanged ? current : { document: structuredClone(document), schemaVersion: 2,
        documentId: newIdentity ? randomUUID() : current.documentId ?? randomUUID(), revision: current.revision + 1 };
      if (!Number.isSafeInteger(next.revision)) invalid('The revision counter is exhausted. Export a backup.');
      serializeBackup(next); // Shared maximum document size, before any SQL mutation.
      const timestamp = new Date(now()).toISOString();
      const receipt = { opId: input.opId, documentId: next.documentId, revision: next.revision, changed: !unchanged };
      if (!unchanged) {
        const raw = JSON.stringify(current), bytes = Buffer.byteLength(raw);
        if (bytes > BUDGETS.history.bytes) throw new StoreError('quota', 'The pre-change snapshot exceeds the history budget.');
        db.prepare('INSERT INTO history (id,savedAt,raw,bytes) VALUES (?,?,?,?)').run(randomUUID(), timestamp, raw, bytes);
        db.prepare('INSERT INTO document (id,record) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(JSON.stringify(next));
        const entry = JSON.stringify({ ...receipt, kind: input.kind, source: actor, at: timestamp });
        db.prepare('INSERT INTO journal (entry,bytes) VALUES (?,?)').run(entry, Buffer.byteLength(entry));
        db.prepare("INSERT INTO meta (key,value) VALUES ('backupDirty','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
      }
      const encoded = JSON.stringify(receipt);
      db.prepare('INSERT INTO ops (id,hash,receipt,bytes) VALUES (?,?,?,?)').run(input.opId, hash, encoded, Buffer.byteLength(encoded) + Buffer.byteLength(input.opId) + 64);
      for (const table of Object.keys(BUDGETS)) prune(table);
      db.exec('COMMIT');
      return { ...next, receipt };
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* BEGIN may itself have failed. */ }
      if (error instanceof StoreError) throw error;
      throw new StoreError('write-failed', 'The change could not be saved. Previous data is unchanged. Check disk space and retry.');
    }
  }
  const storage = { db, load, version, write, history: {
    list: () => db.prepare('SELECT id,seq AS "order",savedAt FROM history ORDER BY seq DESC').all(), read: readHistory,
  }, close() { try { db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } finally { db.close(); } },
  openAdapter() { return createRemoteAdapter(async (route, input) => {
    if (route === 'document') return load();
    if (route === 'version') return version();
    if (route === 'history') return storage.history.list();
    if (route === 'history/read') return readHistory(input.id);
    return write(input);
  }); } };
  return storage;
}
