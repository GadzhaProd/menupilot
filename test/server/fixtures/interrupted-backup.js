import { backup } from 'node:sqlite';
import { createSqliteStorage } from '../../../server/sqlite.js';
import { manageBackups } from '../../../server/backups.js';
import { join } from 'node:path';
const dir = process.argv[2];
const raw = createSqliteStorage(join(dir, 'menupilot.db'));
raw.write({ kind: 'save', document: raw.load().document, expectedDocumentId: null, expectedRevision: 0, opId: 'before-kill' });
// Make multiple backup steps deterministic without changing the domain document.
raw.db.exec('CREATE TABLE padding(data BLOB); INSERT INTO padding VALUES(zeroblob(4194304));');
let notified = false;
await manageBackups(raw, dir, { timers: false, backupImpl: (db, path) => backup(db, path, { rate: 1, progress({ remainingPages }) {
  if (!notified && remainingPages > 0) {
    notified = true;
    process.send({ copying: true });
    // Halt exactly inside a real SQLite backup step. The parent kills us here.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000);
  }
} }) });
