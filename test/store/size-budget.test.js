import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { HISTORY_LIMIT, HISTORY_PREFIX } from '../../src/store/history.js';
import { parseBackup, serializeBackup, MAX_DOCUMENT_CHARS, MAX_BACKUP_CHARS } from '../../src/store/serialization.js';
import { memoryStorage, smallDocument, encoded, DEMO_NOW, quotaError } from './fixtures.js';

// Valid synthetic catalogs: long Unicode names and append-only price histories.
function catalog(count = 2000) {
  const doc = smallDocument(), template = doc.ingredients[0];
  doc.ingredients = Array.from({ length: count }, (_, i) => ({ ...template, id: `i${i + 1}`,
    name: '界'.repeat(200), prices: Array.from({ length: 20 }, (_, seq) => ({ ...template.prices[0], seq: seq + 1 })) }));
  return doc;
}
const open = async (storage, adapter) => {
  const store = createStore(storage, { demo: smallDocument(), now: () => DEMO_NOW, adapter });
  await store.load(); return store;
};
const snapshots = storage => [...storage.data].filter(([k]) => k.startsWith(HISTORY_PREFIX)).map(([,v]) => JSON.parse(v));

function boundaryCatalog(target = 4_999_900) {
  const doc = catalog(), prices = doc.ingredients[0].prices;
  // Grow valid histories by exact serialized lengths, then trim a name to land
  // just below the old whole-envelope limit without depending on whitespace.
  let size = JSON.stringify(doc).length, index = 0;
  while (size < target) {
    const ingredient = doc.ingredients[index++ % doc.ingredients.length];
    const price = { ...prices[0], seq: ingredient.prices.length + 1 };
    ingredient.prices.push(price); size += JSON.stringify(price).length + 1;
  }
  doc.ingredients[1].name = doc.ingredients[1].name.slice(size - target);
  return doc;
}

test('the document budget survives fresh identity and operation receipts at the exact boundary', async () => {
  const document = boundaryCatalog();
  assert.equal(JSON.stringify(document).length, 4_999_900);
  const raw = JSON.stringify({ version: 2, schemaVersion: 2, documentId: 'x', revision: 1, document });
  assert.ok(raw.length <= 5_000_000);
  const first = await open(memoryStorage({ [STORAGE_KEY]: raw }));
  const second = await open(memoryStorage());
  await second.importJSON(await first.exportJSON());
  assert.deepEqual(second.getDocument(), document);
});

test('exact document limit leaves room for bounded receipts, while one extra character is rejected before writing', async () => {
  const document = boundaryCatalog(MAX_DOCUMENT_CHARS);
  const raw = serializeBackup({ document, documentId: 'd'.repeat(100), revision: Number.MAX_SAFE_INTEGER,
    operationIds: Array.from({ length: 128 }, (_, i) => String(i).padEnd(200, 'x')) });
  assert.ok(raw.length > MAX_DOCUMENT_CHARS && raw.length <= MAX_BACKUP_CHARS);
  assert.deepEqual(parseBackup(raw).document, document);
  assert.deepEqual(parseBackup(serializeBackup({ document, documentId: 'x', revision: 1 }, true)).document, document);
  const storage = memoryStorage(), store = await open(storage);
  await store.importJSON(JSON.stringify(document));
  const previous = [...storage.data], current = store.getDocument();
  const tooLarge = structuredClone(document);
  tooLarge.ingredients[1].name += 'x';
  await assert.rejects(store.save(tooLarge), { code: 'invalid' });
  assert.deepEqual([...storage.data], previous);
  assert.equal(store.getDocument(), current);
});

test('local HTTP/SQLite uses the same large-document export/import budget', async t => {
  const { createSqliteStorage } = await import('../../server/sqlite.js');
  const { serveLocal, MAX_BODY_BYTES } = await import('../../server/http.js');
  const { createHttpStorageAdapter } = await import('../../src/store/httpAdapter.js');
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-size-budget-'));
  const sqlite = createSqliteStorage(':memory:', { initialDocument: smallDocument(), now: () => DEMO_NOW });
  t.after(() => { sqlite.close(); rmSync(dir, { recursive: true }); });
  writeFileSync(join(dir, 'index.html'), '<html><head></head><body></body></html>');
  const server = await serveLocal({ storage: sqlite, dataDir: dir, distDir: dir, port: 0 });
  t.after(() => server.close());
  const login = await fetch(`${server.address}/menupilot/session`, { method: 'POST',
    headers: { Origin: server.address, 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: server.openUrl.split('#k=')[1] }) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const adapter = createHttpStorageAdapter({ baseUrl: server.address, token,
    fetchImpl: (url, options) => fetch(url, { ...options, headers: { ...options.headers, Origin: server.address } }) });
  const store = await open(null, adapter), document = boundaryCatalog(MAX_DOCUMENT_CHARS);
  assert.ok(Buffer.byteLength(JSON.stringify({ kind: 'import', source: { document } })) < MAX_BODY_BYTES);
  await store.importJSON(JSON.stringify(document));
  const exported = await store.exportJSON();
  assert.ok(Buffer.byteLength(exported) > 5_000_000);
  await store.resetToEmpty();
  await store.importJSON(exported);
  assert.deepEqual(sqlite.load().document, document);
  const browser = await open(memoryStorage());
  await browser.importJSON(await store.exportJSON());
  assert.deepEqual(browser.getDocument(), document);
});

test('a large saved Unicode catalog exports and imports through the same character budget', async () => {
  const document = catalog();
  assert.ok(encoded(document).length < 5_000_000);
  assert.ok(JSON.stringify(JSON.parse(encoded(document)), null, 2).length > 5_000_000);
  assert.ok(Buffer.byteLength(encoded(document)) > 5_000_000);
  const first = await open(memoryStorage());
  await first.importJSON(JSON.stringify(document));
  await first.updateIngredient('i1', { name: 'Saved change' });
  const backup = await first.exportJSON();
  assert.ok(backup.length <= 5_000_000);
  assert.deepEqual(parseBackup(backup).document, first.getDocument());
  const second = await open(memoryStorage());
  await second.importJSON(backup);
  assert.deepEqual(second.getDocument(), first.getDocument());
});

for (const [name, replace] of [
  ['import', store => store.importJSON(JSON.stringify(smallDocument()))],
  ['empty reset', store => store.resetToEmpty()],
  ['demo reset', store => store.resetToDemo()],
]) test(`mandatory ${name} copy may exceed the automatic history budget`, async () => {
  const document = catalog(300), raw = encoded(document);
  assert.ok(raw.length * 2 > HISTORY_LIMIT);
  const storage = memoryStorage({ [STORAGE_KEY]: raw }), store = await open(storage);
  await replace(store);
  const previous = snapshots(storage).find(entry => entry.raw === raw);
  assert.ok(previous, 'exact pre-replacement bytes must remain recoverable');
  await store.restoreHistory(previous.id);
  assert.deepEqual(store.getDocument(), document);
});

test('large restore keeps both its target and current bytes after a failed main write', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: encoded(catalog(300)) });
  let fail = false;
  const storage = { ...backing, setItem(k,v) { if (fail && k === STORAGE_KEY) throw quotaError(); backing.setItem(k,v); } };
  const store = await open(storage);
  await store.importJSON(JSON.stringify(catalog(310)));
  const target = snapshots(backing)[0], current = backing.getItem(STORAGE_KEY);
  fail = true;
  await assert.rejects(store.restoreHistory(target.id), { code: 'quota' });
  assert.equal(backing.getItem(STORAGE_KEY), current);
  assert.ok(snapshots(backing).some(entry => entry.raw === current));
  assert.ok(snapshots(backing).some(entry => entry.id === target.id && entry.raw === target.raw));
  fail = false;
  await store.restoreHistory(target.id);
  assert.deepEqual(store.getDocument(), catalog(300));
});

test('a real quota refusal still cancels a large replacement without changing current data', async () => {
  const raw = encoded(catalog(300)), backing = memoryStorage({ [STORAGE_KEY]: raw });
  const store = await open({ ...backing, setItem(k,v) { if (k.startsWith(HISTORY_PREFIX)) throw quotaError(); backing.setItem(k,v); } });
  await assert.rejects(store.resetToEmpty(), { code: 'quota' });
  assert.equal(backing.getItem(STORAGE_KEY), raw);
  assert.deepEqual(store.getDocument(), catalog(300));
});

test('an exhausted internal history counter reports its own limit, not browser quota', async () => {
  const raw = encoded(smallDocument());
  const storage = memoryStorage({ [STORAGE_KEY]: raw, [`${HISTORY_PREFIX}0`]: JSON.stringify({
    id: 'old', order: Number.MAX_SAFE_INTEGER, savedAt: DEMO_NOW, raw: JSON.stringify(smallDocument()),
  }) });
  const store = await open(storage);
  await assert.rejects(store.resetToEmpty(), error => error.code === 'history-limit' && !/free|full|quota/i.test(error.message));
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
