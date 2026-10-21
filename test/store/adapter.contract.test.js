import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserStorageAdapter } from '../../src/store/browserAdapter.js';
import { memoryStorage, smallDocument, readDemo, DEMO_NOW } from './fixtures.js';

import { createStore } from '../../src/store/store.js';
import { parseBackup, serializeBackup } from '../../src/store/serialization.js';

// Future D/C fixtures supply open(), failWrites(), readSaved(); tests do not inspect browser keys.
export function storageAdapterContract(name, fixture) {
  const check = (label, run) => test(`${name}: ${label}`, async () => run(fixture()));
  check('CAS conflict returns latest revision and document', async ({open}) => {
    const a=open(), b=open(); const first=await a.load(); await b.load();
    const doc=structuredClone(first.document); doc.ingredients[0].name='Changed';
    const saved=await a.save(doc,first.revision,'save-1');
    const result=await b.save(first.document,first.revision,'save-2');
    assert.equal(result.conflict,true); assert.equal(result.revision,saved.revision);
    assert.deepEqual(result.document,doc);
  });
  check('wrong expected revision does not write', async ({open,readSaved}) => {
    const a=open(), first=await a.load(), before=readSaved();
    const result=await a.save(first.document,first.revision+1,'wrong');
    assert.equal(result.conflict,true); assert.equal(result.revision,first.revision); assert.equal(readSaved(),before);
  });
  check('reads are detached and history lists metadata only', async ({open}) => {
    const a=open(), first=await a.load(), original=structuredClone(first.document);
    first.document.ingredients[0].name='Changed';
    const saved=await a.save(first.document,first.revision,'change');
    first.document.ingredients[0].name='Detached';
    const entries=await a.history.list(); assert.ok(entries.length);
    assert.ok(entries.every(entry=>!('raw' in entry)&&!('document' in entry)));
    assert.deepEqual((await a.history.read(entries[0].id)).document,original);
    const restored=await a.history.restore(entries[0].id,saved.revision,'restore');
    assert.ok(restored.revision>saved.revision); assert.equal(restored.documentId,saved.documentId);
  });
  check('unknown history ID is rejected', async ({open}) => {
    const a=open();await a.load();await assert.rejects(a.history.read('missing'),{code:'not-found'});
  });
  check('foreign import receives a fresh identity; same-dataset import keeps identity and advances revision', async ({open}) => {
    const a=open();const first=await a.load();const one=await a.save(first.document,first.revision,'one');
    const two=await a.importDocument({...one,documentId:'foreign',revision:9000},one.revision,'foreign');
    assert.notEqual(two.documentId,'foreign');assert.notEqual(two.documentId,one.documentId);
    const three=await a.importDocument(two,two.revision,'same');
    assert.equal(three.documentId,two.documentId);assert.ok(three.revision>two.revision);
  });
  check('invalid imports are rejected by the common store before reaching the adapter', async ({open,readSaved}) => {
    const a=open(); const first=await a.load(); const store=createStore(null,{adapter:a,demo:first.document,now:()=>DEMO_NOW});
    await store.load(); const before=readSaved();
    for(const text of ['{bad',JSON.stringify({...first,version:2,schemaVersion:2,documentId:23})]) await assert.rejects(store.importJSON(text));
    assert.equal(readSaved(),before);assert.deepEqual(store.getDocument(),first.document);
  });
  check('successful save and import opId retries survive reopening without another write', async ({open,readSaved}) => {
    const a=open();const first=await a.load();const doc=structuredClone(first.document);doc.ingredients[0].name='Once';
    const one=await a.save(doc,first.revision,'repeat-save');const bytes=readSaved();
    const reopened=open();await reopened.load();const retry=await reopened.save(doc,first.revision,'repeat-save');
    assert.equal(retry.conflict,undefined);assert.equal(retry.revision,one.revision);assert.equal(readSaved(),bytes);
    const two=await reopened.importDocument({...one,documentId:'foreign'},one.revision,'repeat-import');const imported=readSaved();
    const other=open();await other.load();const replay=await other.importDocument({...one,documentId:'foreign'},one.revision,'repeat-import');
    assert.equal(replay.conflict,undefined);assert.equal(replay.documentId,two.documentId);assert.equal(replay.revision,two.revision);assert.equal(readSaved(),imported);
  });
  check('failed write leaves document unchanged and retry can succeed', async ({open,failWrites,readSaved}) => {
    const a=open();const first=await a.load(), before=readSaved();const doc=structuredClone(first.document);doc.ingredients[0].name='Retry';
    failWrites(true);await assert.rejects(a.save(doc,first.revision,'retry'),{code:'write-failed'});assert.equal(readSaved(),before);
    failWrites(false);const saved=await a.save(doc,first.revision,'retry');assert.ok(saved.revision>first.revision);
  });
}

storageAdapterContract('BrowserStorageAdapter', () => {
  const backing = memoryStorage({ 'menupilot:v1': JSON.stringify(smallDocument()) });
  let failure = false;
  const storage = { ...backing, setItem(k,v) { if (failure && k === 'menupilot:v1') throw new Error('disk failed'); backing.setItem(k,v); } };
  return { open: () => createBrowserStorageAdapter(storage, { initialDocument: smallDocument(), now: () => DEMO_NOW }),
    failWrites: value => { failure = value; }, readSaved: () => backing.getItem('menupilot:v1') };
});

for (const [name, document] of [['real catalog', smallDocument()], ['bundled demo', readDemo()]]) {
  test(`v1 ${name}: read-only upgrade, exact original archived before v2 commit`, async () => {
    const raw = JSON.stringify(document, null, 2);
    const storage = memoryStorage({ 'menupilot:v1': raw });
    const adapter = createBrowserStorageAdapter(storage, { initialDocument: smallDocument(), now: () => DEMO_NOW });
    const loaded = await adapter.load();
    assert.deepEqual(loaded.document, document);
    assert.equal(storage.getItem('menupilot:v1'), raw);
    await adapter.save(document, loaded.revision);
    const encoded = JSON.parse(storage.getItem('menupilot:v1'));
    assert.equal(encoded.version, 2); assert.equal(encoded.schemaVersion, 2);
    assert.ok(encoded.documentId); assert.equal(encoded.revision, 1);
    assert.equal(storage.getItem('menupilot:premigration-v1'), raw);
    assert.deepEqual((await adapter.importDocument(parseBackup(raw), 1)).document, document);
  });
}

test('wrong revision, foreign import and restore never reuse a committed revision', async () => {
  const storage = memoryStorage();
  const a = createBrowserStorageAdapter(storage, { initialDocument: smallDocument(), now: () => DEMO_NOW });
  const loaded = await a.load();
  assert.equal((await a.save(loaded.document, 99)).conflict, true);
  assert.equal(storage.getItem('menupilot:v1'), null);
  const one = await a.save(loaded.document, 0);
  const foreign = JSON.stringify({ version: 2, schemaVersion: 2, revision: 9000, documentId: 'foreign', document: readDemo() });
  const two = await a.importDocument(parseBackup(foreign), one.revision);
  assert.notEqual(two.documentId, 'foreign'); assert.notEqual(two.documentId, one.documentId); assert.equal(two.revision, one.revision + 1);
  const old = (await a.history.list())[0];
  const three = await a.history.restore(old.id, two.revision);
  assert.equal(three.revision, two.revision + 1);
  const four = await a.importDocument(parseBackup(JSON.stringify(smallDocument())), three.revision);
  assert.notEqual(four.documentId, three.documentId);
  assert.equal(four.revision, three.revision + 1);
});

test('failed migration never replaces v1 when its exact original cannot be archived', async () => {
  const raw = JSON.stringify(smallDocument());
  const backing = memoryStorage({ 'menupilot:v1': raw });
  const adapter = createBrowserStorageAdapter({ ...backing, setItem(k,v) {
    if (k === 'menupilot:premigration-v1') throw new Error('source backup unavailable');
    backing.setItem(k,v);
  } }, { initialDocument: smallDocument() });
  const loaded = await adapter.load();
  await assert.rejects(adapter.save(loaded.document, loaded.revision), { code: 'migration-backup-required' });
  assert.equal(backing.getItem('menupilot:v1'), raw);
  assert.equal(backing.getItem('menupilot:revision'), null);
});

test('an interrupted main write burns a revision; reopening cannot rewind it', async () => {
  const backing = memoryStorage(); let fail = false;
  const adapter = createBrowserStorageAdapter({ ...backing, setItem(k,v) {
    if (fail && k === 'menupilot:v1') throw new Error('main failed');
    backing.setItem(k,v);
  } }, { initialDocument: smallDocument() });
  await adapter.load();
  const first = await adapter.save(smallDocument(), 0);
  const edited = smallDocument(); edited.ingredients[0].name = 'Next';
  fail = true;
  await assert.rejects(adapter.save(edited, first.revision));
  const burned = Number(backing.getItem('menupilot:revision'));
  assert.equal(burned, first.revision + 1);
  const reopened = createBrowserStorageAdapter(backing, { initialDocument: smallDocument() });
  const loaded = await reopened.load();
  assert.equal(loaded.revision, first.revision);
  assert.equal((await reopened.save(edited, loaded.revision)).revision, burned + 1);
});

test('same-number external byte changes and ABA through history invalidate old readers', async () => {
  const backing = memoryStorage();
  const open = () => createBrowserStorageAdapter(backing, { initialDocument: smallDocument() });
  const a = open(); await a.load(); await a.save(smallDocument(), 0);
  const b = open(); const stale = await b.load();
  const envelope = JSON.parse(backing.getItem('menupilot:v1'));
  envelope.document.ingredients[0].name = 'External edit with unchanged revision';
  backing.setItem('menupilot:v1', JSON.stringify(envelope));
  assert.equal((await b.save(stale.document, stale.revision)).conflict,true);
  const fresh = await a.load();
  const edited = smallDocument(); edited.ingredients[0].name = 'B';
  const next = await a.save(edited, fresh.revision);
  const snapshot = (await a.history.list())[0];
  await a.history.restore(snapshot.id, next.revision);
  assert.equal((await b.save(stale.document, stale.revision)).conflict,true);
});

test('export/import v2 round-trips all scenarios and metadata without importing the source revision', async () => {
  const doc = smallDocument();
  const { makeScenario } = await import('./fixtures.js');
  doc.scenarios.push(makeScenario(doc, 'd1', { monthlyVolume: 0 }));
  const original = createBrowserStorageAdapter(memoryStorage(), { initialDocument: doc, now: () => DEMO_NOW });
  await original.load(); await original.save(doc, 0);
  const exported = serializeBackup(await original.load());
  const other = createBrowserStorageAdapter(memoryStorage(), { initialDocument: readDemo(), now: () => DEMO_NOW });
  await other.load();
  const imported = await other.importDocument(parseBackup(exported), 0);
  assert.deepEqual(imported.document, doc);
  assert.notEqual(imported.documentId, JSON.parse(exported).documentId);
  assert.equal(imported.revision, 1);
});

test('real v1 client reload refuses the new envelope and its stale writer cannot overwrite it', async () => {
  const { createStore: legacyStore } = await import('./legacyV1Store.js');
  const backing = memoryStorage({ 'menupilot:v1': JSON.stringify(smallDocument()) });
  const stale = legacyStore(backing, { demo: smallDocument(), now: () => DEMO_NOW });
  stale.load();
  const adapter = createBrowserStorageAdapter(backing, { initialDocument: smallDocument() });
  const loaded = await adapter.load(); await adapter.save(loaded.document, loaded.revision);
  const before = backing.getItem('menupilot:v1');
  const reloaded = legacyStore(backing, { demo: smallDocument() });
  assert.throws(() => reloaded.load(), { code: 'unsupported-version', message: /format version 2.*version 1/ });
  assert.throws(() => reloaded.addIngredient({ name: 'Overwrite', unit: 'g' }), { code: 'not-loaded' });
  assert.throws(() => stale.addIngredient({ name: 'Stale', unit: 'g' }), { code: 'conflict' });
  assert.equal(backing.getItem('menupilot:v1'), before);
});

test('an adapter cannot save an existing document before loading its CAS state', async () => {
  const backing = memoryStorage({ 'menupilot:v1': JSON.stringify({ version: 2, schemaVersion: 2, documentId: 'existing', revision: 12, document: smallDocument() }) });
  const adapter = createBrowserStorageAdapter(backing, { initialDocument: readDemo() });
  const before = backing.getItem('menupilot:v1');
  await assert.rejects(adapter.save(readDemo(), 0), { code: 'not-loaded' });
  assert.equal(backing.getItem('menupilot:v1'), before);
});

test('store commands return Promises and reject duplicate appends before the adapter runs twice', async () => {
  const { createStore } = await import('../../src/store/store.js');
  const adapter = createBrowserStorageAdapter(memoryStorage(), { initialDocument: smallDocument(), now: () => DEMO_NOW });
  const save = adapter.save;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let writes = 0;
  adapter.save = async (...args) => { writes++; await gate; return save(...args); };
  const store = createStore(null, { adapter, demo: smallDocument(), now: () => DEMO_NOW });
  await store.load();
  const initial = store.getDocument();
  const one = store.addPrice('i1', { packPriceCents: 123, packSizeMilli: 1000 });
  assert.ok(one instanceof Promise);
  const duplicate = store.addPrice('i1', { packPriceCents: 123, packSizeMilli: 1000 });
  const beforeRelease = store.getDocument();
  release();
  await assert.rejects(duplicate, { code: 'write-busy' });
  assert.equal(writes, 1); assert.equal(beforeRelease, initial);
  await one;
  assert.equal(store.getDocument().ingredients[0].prices.length, 2);
});

test('a reused adapter can explicitly enter recovery without weakening a normal failed reload', async () => {
  const backing = memoryStorage();
  const adapter = createBrowserStorageAdapter(backing, { initialDocument: smallDocument(), now: () => DEMO_NOW });
  await adapter.load(); const saved = await adapter.save(smallDocument(), 0);
  backing.setItem('menupilot:v1', '{damaged');
  await assert.rejects(adapter.load(), { code: 'corrupt-json' });
  assert.equal((await adapter.save(smallDocument(), saved.revision)).conflict,true);
  await assert.rejects(adapter.browserRecovery.loadForRecovery(), { code: 'corrupt-json' });
  const restored = await adapter.importDocument(parseBackup(JSON.stringify(readDemo())), 0);
  assert.ok(restored.revision > saved.revision);
  await assert.rejects(adapter.history.read((await adapter.history.list())[0].id), { code:'corrupt-json' });
});

test('native browser storage fails closed without Web Locks even outside DataProvider', async () => {
  const backing = memoryStorage();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: backing } });
  try {
    const adapter = createBrowserStorageAdapter(backing, { initialDocument: smallDocument(), isolated: false });
    await adapter.load();
    await assert.rejects(adapter.save(smallDocument(), 0), { code: 'write-unavailable' });
    assert.equal(backing.getItem('menupilot:v1'), null);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'window', previous);
    else delete globalThis.window;
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else delete globalThis.navigator;
  }
});
