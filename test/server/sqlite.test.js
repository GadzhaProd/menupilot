import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSqliteStorage } from '../../server/sqlite.js';
import { smallDocument } from '../store/fixtures.js';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-sqlite-'));
  const storage = createSqliteStorage(join(dir, 'data.db'), { initialDocument: smallDocument() });
  t.after(() => { storage.close(); rmSync(dir, { recursive: true }); });
  return storage;
}
const request = (record, document, opId = 'one') => ({ kind: 'save', document,
  expectedDocumentId: record.documentId, expectedRevision: record.revision, opId });

test('SQLite: atomic receipt survives another commit and reopening; payload reuse is refused', async t => {
  const s = fixture(t), first = s.load();
  const doc = structuredClone(first.document); doc.ingredients[0].name = 'Once';
  const input = request(first, doc), one = s.write(input);
  const next = structuredClone(doc); next.ingredients[0].name = 'Twice';
  const two = s.write(request(one, next, 'two'));
  const replay = s.write(input);
  assert.deepEqual(replay.receipt, one.receipt);
  assert.equal(replay.revision, two.revision);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM journal').get().n, 2);
  assert.throws(() => s.write({ ...input, document: next }), { code: 'op-id-reused' });
  assert.equal(s.load().revision, two.revision);
});

test('SQLite: dataset identity is part of CAS even for an equal revision', t => {
  const s = fixture(t), first = s.load();
  const result = s.write({ ...request(first, first.document), expectedDocumentId: 'wrong' });
  assert.equal(result.conflict, true);
  assert.deepEqual(s.load(), first);
});

test('SQLite: save refuses rewriting prices, changing used units and deleting used entities; import is explicit', t => {
  const s = fixture(t), first = s.load();
  for (const mutate of [
    d => { d.ingredients[0].prices[0].packPriceCents++; },
    d => { d.ingredients[0].prices = []; },
    d => { d.ingredients[0].unit = 'ml'; },
    d => { d.recipes[0].outputUnit = 'ml'; },
    d => { d.ingredients.shift(); d.recipes[0].lines = []; },
  ]) {
    const doc = structuredClone(first.document); mutate(doc);
    assert.throws(() => s.write(request(first, doc)), { code: 'invalid-transition' });
    assert.deepEqual(s.load(), first);
  }
  const doc = structuredClone(first.document); doc.ingredients[0].prices[0].packPriceCents++;
  const imported = s.write({ ...request(first, undefined), kind: 'import', source: { ...first, document: doc } });
  assert.notEqual(imported.documentId, first.documentId);
  assert.deepEqual(imported.document, doc);
});

test('SQLite: failed transaction rolls back document, history, journal and receipt', t => {
  const s = fixture(t), first = s.load(), doc = structuredClone(first.document);
  doc.ingredients[0].name = 'Not committed';
  s.db.exec("CREATE TRIGGER fail_journal BEFORE INSERT ON journal BEGIN SELECT RAISE(ABORT, 'disk failure'); END");
  assert.throws(() => s.write(request(first, doc)), { code: 'write-failed' });
  assert.deepEqual(s.load(), first);
  for (const table of ['history', 'journal', 'ops']) assert.equal(s.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  s.db.exec('DROP TRIGGER fail_journal');
  assert.equal(s.write(request(first, doc)).revision, first.revision + 1);
});

test('SQLite: rejects unknown command fields and invalid import metadata', t => {
  const s = fixture(t), first = s.load();
  assert.throws(() => s.write({ ...request(first, first.document), surprise: true }), { code: 'invalid' });
  assert.throws(() => s.write({ ...request(first, undefined), kind: 'import', source: { ...first, documentId: 123 } }), { code: 'invalid' });
});

test('SQLite: durable receipt after database reopen, no-op receipt and bounded history', t => {
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-reopen-'));
  let s = createSqliteStorage(join(dir, 'data.db'), { initialDocument: smallDocument() });
  t.after(() => { s.close(); rmSync(dir, { recursive: true }); });
  const first = s.load(), input = request(first, first.document);
  const one = s.write(input); s.close();
  s = createSqliteStorage(join(dir, 'data.db'));
  assert.deepEqual(s.write(input).receipt, one.receipt);
  assert.equal(s.write(request(one, one.document, 'noop')).receipt.changed, false);
  for (let i = 0; i < 35; i++) {
    const current = s.load(); current.document.ingredients[0].name = `Changed ${i}`;
    s.write(request(current, current.document, `change-${i}`));
  }
  assert.equal(s.history.list().length, 32);
  assert.equal(s.db.prepare('PRAGMA synchronous').get().synchronous, 2);
  assert.equal(s.db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
});

test('SQLite: retention bounds ops and journal by count and UTF-8 bytes', t => {
  const s = fixture(t), first = s.load();
  s.db.exec('BEGIN');
  const op = s.db.prepare('INSERT INTO ops (id,hash,receipt,bytes) VALUES (?,?,?,?)');
  for (let i=0;i<4100;i++) op.run(`old-${i}`, 'hash', '{}', 80);
  const entry = JSON.stringify({ opId: 'é'.repeat(200), source: 'ui', revision: 1, documentId: 'old' });
  const journal = s.db.prepare('INSERT INTO journal (entry,bytes) VALUES (?,?)');
  for (let i=0;i<10001;i++) journal.run(entry,Buffer.byteLength(entry));
  s.db.exec('COMMIT');
  const result = s.write(request(first, first.document));
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM ops').get().n,4096);
  const limits = s.db.prepare('SELECT count(*) AS n, sum(bytes) AS bytes FROM journal').get();
  assert.ok(limits.n<=10000);assert.ok(limits.bytes<=4*1024*1024);
  assert.deepEqual(s.write(request(first, first.document)).receipt,result.receipt);
});

test('SQLite: deleting a dish requires removing its saved scenarios too', async t => {
  const { makeScenario } = await import('../store/fixtures.js');
  const s = fixture(t), first = s.load();
  first.document.scenarios.push(makeScenario(first.document,'d1'));
  const saved = s.write(request(first,first.document));
  const candidate = structuredClone(saved.document); candidate.recipes = candidate.recipes.filter(r => r.id !== 'd1');
  assert.throws(() => s.write(request(saved,candidate,'delete')), { code: 'invalid-transition' });
  candidate.scenarios = [];
  assert.equal(s.write(request(saved,candidate,'delete')).revision,saved.revision+1);
});

test('SQLite: newer DB version is refused; corrupt stored documents fail closed', async t => {
  const { DatabaseSync } = await import('node:sqlite');
  const dir = mkdtempSync(join(tmpdir(), 'menupilot-version-')), path = join(dir,'data.db');
  t.after(() => rmSync(dir,{recursive:true}));
  const future = new DatabaseSync(path); future.exec('PRAGMA user_version=99'); future.close();
  assert.throws(() => createSqliteStorage(path),{code:'unsupported-version'});
  const verify = new DatabaseSync(path); assert.equal(verify.prepare('PRAGMA user_version').get().user_version,99);verify.close();
  const s = fixture(t), first = s.load(); s.write(request(first,first.document));
  const malformed = s.load(); malformed.document.ingredients[0].unit = 'kg';
  s.db.prepare('UPDATE document SET record=?').run(JSON.stringify(malformed));
  assert.throws(() => s.load(),{code:'invalid'});
});

test('SQLite: reset accepts only canonical empty or localized demo data', async t => {
  const {readFileSync}=await import('node:fs');
  const {emptyDocument}=await import('../../src/store/schema.js');
  const {shiftDemoDates}=await import('../../src/store/demo.js');
  const s=fixture(t);
  const reset=(document,resetKind,opId)=>s.write({...request(s.load(),document,opId),kind:'reset',resetKind});
  const before=s.load();
  assert.throws(()=>reset(before.document,'empty','fake-empty'),{code:'invalid'});
  assert.throws(()=>reset(before.document,'demo','fake-demo'),{code:'invalid'});
  assert.deepEqual(s.load(),before);
  reset(emptyDocument(),'empty','empty');
  for(const locale of ['', '.nl']) {
    const demo=shiftDemoDates(JSON.parse(readFileSync(new URL(`../../data/demo${locale}.json`,import.meta.url))),new Date().toISOString());
    reset(demo,'demo','demo'+locale);
    const forged=structuredClone(demo);forged.ingredients[0].prices[0].packPriceCents++;
    const current=s.load();assert.throws(()=>reset(forged,'demo','forged'+locale),{code:'invalid'});
    assert.deepEqual(s.load(),current);
  }
});

test('SQLite: deleting an unused ingredient with prices snapshots and describes the loss in journal', t => {
  const s = fixture(t), first = s.load();
  const doc = structuredClone(first.document);
  doc.ingredients.push({ ...structuredClone(doc.ingredients[0]), id: 'unused', name: 'Removed flour' });
  const saved = s.write(request(first, doc, 'add-unused'));
  doc.ingredients = doc.ingredients.filter(i => i.id !== 'unused');
  s.write(request(saved, doc, 'delete-unused'));
  const entry = JSON.parse(s.db.prepare('SELECT entry FROM journal ORDER BY seq DESC LIMIT 1').get().entry);
  assert.deepEqual(entry.removedIngredients, [{ id: 'unused', priceEntries: first.document.ingredients[0].prices.length }]);
  assert.match(entry.description, /Deleted 1 ingredient.*price history/);
  const prior = s.history.read(s.history.list()[0].id);
  assert.deepEqual(prior.document, saved.document);
});
