import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { storageAdapterContract } from '../store/adapterContract.js';
import { smallDocument } from '../store/fixtures.js';
import { createSqliteStorage } from '../../server/sqlite.js';

export function sqliteFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-contract-'));
  const storage = createSqliteStorage(join(dir, 'data.db'), { initialDocument: smallDocument() });
  return { storage, dir, open: async () => storage.openAdapter(),
    readSaved: () => JSON.stringify(storage.load()),
    failWrites: fail => storage.db.exec(fail
      ? "CREATE TRIGGER fail_write BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'disk full'); END"
      : 'DROP TRIGGER fail_write'),
    close() { storage.close(); rmSync(dir, { recursive: true }); },
  };
}
storageAdapterContract('SqliteStorage', sqliteFixture);
