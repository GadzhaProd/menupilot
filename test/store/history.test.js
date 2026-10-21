import { encoded, decoded } from './fixtures.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, smallDocument, quotaError, DEMO_NOW } from './fixtures.js';
const open = async storage => { const s = createStore(storage, { demo: smallDocument(), now: () => DEMO_NOW }); (await s.load()); return s; };

test('archives checked previous bytes before each write and restores through CAS', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = (await open(storage)), stale = (await open(storage)), before = storage.getItem(STORAGE_KEY);
  (await s.updateIngredient('i1', { name: 'Changed' }));
  const entries = (await s.listHistory());
  assert.equal(entries.length, 1); assert.equal(entries[0].raw, before);
  (await s.restoreHistory(entries[0].id));
  assert.equal(s.getDocument().ingredients[0].name, 'i1');
  assert.equal((await s.listHistory()).length, 2);
  (await assert.rejects(async () => (await stale.updateSettings({ defaultVatRateBp: 2100 })), { code: 'conflict' }));
});

test('retains at most ten versions and one MiB including UTF-16 keys and values', async () => {
  const storage = memoryStorage(); const s = (await open(storage));
  for (let i = 0; i < 15; i++) (await s.updateIngredient('i1', { name: `Name ${i}` }));
  assert.equal((await s.listHistory()).length, 10);
  assert.equal(decoded((await s.listHistory()).at(-1).raw).ingredients[0].name, 'Name 4');
  const bytes = [...storage.data].filter(([k]) => k.startsWith('menupilot:history:')).reduce((n, [k,v]) => n + 2*(k.length+v.length), 0);
  assert.ok(bytes <= 1024*1024);
});

test('history failure warns but permits ordinary save; main failure preserves data and memory', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: encoded(smallDocument()) });
  let failMain = false;
  const storage = { ...backing, setItem(k,v) { if (k.startsWith('menupilot:history:') || failMain) throw quotaError(); backing.setItem(k,v); } };
  const s = (await open(storage)); (await s.updateIngredient('i1', { name: 'Saved' }));
  assert.equal(s.getHistoryWarning(), true);
  const before = backing.getItem(STORAGE_KEY), document = s.getDocument();
  failMain = true;
  (await assert.rejects(async () => (await s.updateIngredient('i1', { name: 'Not saved' })), { code: 'quota' }));
  assert.equal(backing.getItem(STORAGE_KEY), before); assert.equal(s.getDocument(), document);
});

test('a failed main write leaves its previous snapshot; conflicts create none', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = (await open({ ...backing, setItem(k,v) { if (k === STORAGE_KEY) throw quotaError(); backing.setItem(k,v); } }));
  (await assert.rejects(async () => (await s.updateIngredient('i1', { name: 'Not saved' })), { code: 'quota' }));
  assert.equal((await s.listHistory())[0].raw, backing.getItem(STORAGE_KEY));
  const stale = (await open(backing)); (await (await open(backing)).resetToEmpty());
  const history = (await stale.listHistory());
  (await assert.rejects(async () => (await stale.resetToEmpty()), { code: 'conflict' }));
  assert.deepEqual((await stale.listHistory()), history);
});

test('corrupt main data can restore a valid snapshot but an invalid snapshot is rejected', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = (await open(storage)); (await s.resetToEmpty()); const entry = (await s.listHistory())[0];
  storage.setItem(STORAGE_KEY, '{bad');
  const recovery = createStore(storage, { demo: smallDocument(), now: () => DEMO_NOW });
  (await assert.rejects(async () => (await recovery.load())));
  (await recovery.restoreHistory(entry.id));
  assert.deepEqual(recovery.getDocument(), smallDocument());
  const damaged = (await recovery.listHistory()).find(e => e.raw === '{bad');
  const before = storage.getItem(STORAGE_KEY);
  (await assert.rejects(async () => (await recovery.restoreHistory(damaged.id))));
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('backup reminder starts with own changes, waits seven days and resets after Export', async () => {
  let clock = Date.parse(DEMO_NOW);
  const storage = memoryStorage();
  const s = createStore(storage, { demo: smallDocument(), now: () => clock }); (await s.load());
  assert.equal(s.getBackupStatus().due, false);
  clock += 8*86400000; assert.equal(s.getBackupStatus().due, false);
  (await s.updateIngredient('i1', { name: 'My ingredient' }));
  clock += 6*86400000; assert.equal(s.getBackupStatus().due, false);
  clock += 86400000; assert.equal(s.getBackupStatus().due, true);
  (await s.recordExport()); assert.equal(s.getBackupStatus().due, false);
  assert.equal(s.getBackupStatus().lastExportAt, new Date(clock).toISOString());
  clock += 7*86400000; assert.equal(s.getBackupStatus().due, true);
  (await s.resetToDemo()); assert.equal(s.getBackupStatus().due, false);
});

test('memory recovery requires absent current storage and uses normal persistence', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = (await open(storage)); storage.removeItem(STORAGE_KEY); (await s.saveMemoryAsNew());
  assert.deepEqual(decoded(storage.getItem(STORAGE_KEY)), smallDocument());
  (await assert.rejects(async () => (await s.saveMemoryAsNew()), { code: 'conflict' }));
});

test('large histories evict by UTF-16 size before the ten-version limit', async () => {
  const doc = smallDocument();
  doc.ingredients.push(...Array.from({ length: 500 }, (_, i) => ({ ...doc.ingredients[0], id: `bulk${i}`, name: 'Ingredient '.repeat(8) })));
  const storage = memoryStorage({ [STORAGE_KEY]: encoded(doc) }), s = (await open(storage));
  for (let i = 0; i < 12; i++) (await s.updateIngredient('i1', { name: `Name ${i}` }));
  assert.ok((await s.listHistory()).length > 0 && (await s.listHistory()).length < 10);
  const size = [...storage.data].filter(([k]) => k.startsWith('menupilot:history:')).reduce((n,[k,v]) => n+2*(k.length+v.length),0);
  assert.ok(size <= 1024*1024);
});

test('storage quota evicts oldest snapshots, but never the just-archived current version', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let budget = Infinity;
  const storage = { ...backing, setItem(k,v) {
    const next = new Map(backing.data); next.set(k,v);
    if ([...next].reduce((n,[key,value]) => n+2*(key.length+value.length),0) > budget) throw quotaError();
    backing.setItem(k,v);
  } };
  const s = (await open(storage)); (await s.updateIngredient('i1', { name: 'First' })); (await s.updateIngredient('i1', { name: 'Second' }));
  const size = [...backing.data].reduce((n,[k,v]) => n+2*(k.length+v.length),0);
  budget = size + 100;
  const previous = backing.getItem(STORAGE_KEY);
  (await s.updateIngredient('i1', { name: 'Third' }));
  assert.equal((await s.listHistory())[0].raw, previous);
  assert.ok((await s.listHistory()).length <= 2);
});

test('destructive replacements refuse when no previous snapshot can be stored', async () => {
  for (const action of [async s => (await s.resetToEmpty()), async s => (await s.resetToDemo()), async s => (await s.importJSON(JSON.stringify(smallDocument()))), async s => (await s.restoreHistory((await s.listHistory())[0].id))]) {
    const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
    (await (await open(backing)).updateIngredient('i1', { name: 'Own changed data' }));
    const s = (await open({ ...backing, setItem(k,v) { if (k.startsWith('menupilot:history:')) throw quotaError(); backing.setItem(k,v); } }));
    const before = backing.getItem(STORAGE_KEY);
    (await assert.rejects(() => action(s), { code: 'quota' }));
    assert.equal(backing.getItem(STORAGE_KEY), before);
  }
});

test('a snapshot exceeding one MiB warns while the ordinary document save still succeeds', async () => {
  const doc = smallDocument();
  doc.ingredients.push(...Array.from({ length: 1998 }, (_, i) => ({ ...doc.ingredients[0], id: `large${i}`, name: 'Long name '.repeat(10) })));
  const storage = memoryStorage({ [STORAGE_KEY]: encoded(doc) }), s = (await open(storage));
  (await s.updateIngredient('i1', { name: 'Saved without snapshot' }));
  assert.equal(s.getHistoryWarning(), true); assert.equal((await s.listHistory()).length, 0);
  assert.equal(decoded(storage.getItem(STORAGE_KEY)).ingredients[0].name, 'Saved without snapshot');
});

test('identical saves do not write, archive, or evict genuine versions', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let writes = 0;
  const s = (await open({ ...backing, setItem(k,v) { writes++; backing.setItem(k,v); } }));
  (await s.updateIngredient('i1', { name: 'Actual change' }));
  const history = (await s.listHistory()), before = writes, document = s.getDocument();
  for (let i = 0; i < 10; i++) (await s.save(document));
  assert.equal(writes, before);
  assert.deepEqual((await s.listHistory()), history);
});

test('retry after failed main write does not duplicate the newest snapshot', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let fail = true;
  const s = (await open({ ...backing, setItem(k,v) { if (fail && k === STORAGE_KEY) throw new Error('failed'); backing.setItem(k,v); } }));
  (await assert.rejects(async () => (await s.updateIngredient('i1', { name: 'Changed' }))));
  const history = (await s.listHistory()); fail = false;
  (await s.updateIngredient('i1', { name: 'Changed' }));
  assert.deepEqual((await s.listHistory()), history);
});

test('restoring the oldest of a full history preserves that snapshot on main-write failure and quota eviction', async () => {
  for (const failure of [new Error('failed'), quotaError()]) {
    const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
    let fail = false;
    const s = (await open({ ...backing, setItem(k,v) { if (fail && k === STORAGE_KEY) throw failure; backing.setItem(k,v); } }));
    for (let i = 0; i < 10; i++) (await s.updateIngredient('i1', { name: `Version ${i}` }));
    const oldest = (await s.listHistory()).at(-1), current = backing.getItem(STORAGE_KEY);
    fail = true;
    (await assert.rejects(async () => (await s.restoreHistory(oldest.id))));
    assert.equal(backing.getItem(STORAGE_KEY), current);
    assert.ok((await s.listHistory()).some(e => e.id === oldest.id && e.raw === oldest.raw));
    assert.ok((await s.listHistory()).some(e => e.raw === current));
    fail = false; (await s.restoreHistory(oldest.id));
    assert.deepEqual(decoded(backing.getItem(STORAGE_KEY)), decoded(oldest.raw));
  }
});

test('backup reminders can be deferred seven days without claiming an Export', async () => {
  let clock = Date.parse(DEMO_NOW);
  const storage = memoryStorage();
  const s = createStore(storage, { demo: smallDocument(), now: () => clock }); (await s.load());
  (await s.updateIngredient('i1', { name: 'Own data' })); clock += 7*86400000;
  (await s.remindLater()); assert.equal(s.getBackupStatus().due, false);
  assert.equal(s.getBackupStatus().lastExportAt, null);
  clock += 6*86400000; assert.equal(s.getBackupStatus().due, false);
  clock += 86400000; assert.equal(s.getBackupStatus().due, true);
});

test('archive quota never evicts the version being restored', async () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let failHistory = false;
  const s = (await open({ ...backing, setItem(k,v) { if (failHistory && k.startsWith('menupilot:history:')) throw quotaError(); backing.setItem(k,v); } }));
  for (let i = 0; i < 10; i++) (await s.updateIngredient('i1', { name: `Version ${i}` }));
  const oldest = (await s.listHistory()).at(-1), current = backing.getItem(STORAGE_KEY);
  failHistory = true;
  (await assert.rejects(async () => (await s.restoreHistory(oldest.id)), { code: 'quota' }));
  assert.equal(backing.getItem(STORAGE_KEY), current);
  assert.ok((await s.listHistory()).some(e => e.id === oldest.id));
});
