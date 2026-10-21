import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, smallDocument, quotaError, DEMO_NOW } from './fixtures.js';
const open = storage => { const s = createStore(storage, { demo: smallDocument(), now: () => DEMO_NOW }); s.load(); return s; };

test('archives checked previous bytes before each write and restores through CAS', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = open(storage), stale = open(storage), before = storage.getItem(STORAGE_KEY);
  s.updateIngredient('i1', { name: 'Changed' });
  const entries = s.listHistory();
  assert.equal(entries.length, 1); assert.equal(entries[0].raw, before);
  s.restoreHistory(entries[0].id);
  assert.equal(s.getDocument().ingredients[0].name, 'i1');
  assert.equal(s.listHistory().length, 2);
  assert.throws(() => stale.updateSettings({ defaultVatRateBp: 2100 }), { code: 'conflict' });
});

test('retains at most ten versions and one MiB including UTF-16 keys and values', () => {
  const storage = memoryStorage(); const s = open(storage);
  for (let i = 0; i < 15; i++) s.updateIngredient('i1', { name: `Name ${i}` });
  assert.equal(s.listHistory().length, 10);
  assert.equal(JSON.parse(s.listHistory().at(-1).raw).ingredients[0].name, 'Name 4');
  const bytes = [...storage.data].filter(([k]) => k.startsWith('menupilot:history:')).reduce((n, [k,v]) => n + 2*(k.length+v.length), 0);
  assert.ok(bytes <= 1024*1024);
});

test('history failure warns but permits ordinary save; main failure preserves data and memory', () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let failMain = false;
  const storage = { ...backing, setItem(k,v) { if (k.startsWith('menupilot:history:') || failMain) throw quotaError(); backing.setItem(k,v); } };
  const s = open(storage); s.updateIngredient('i1', { name: 'Saved' });
  assert.equal(s.getHistoryWarning(), true);
  const before = backing.getItem(STORAGE_KEY), document = s.getDocument();
  failMain = true;
  assert.throws(() => s.updateIngredient('i1', { name: 'Not saved' }), { code: 'quota' });
  assert.equal(backing.getItem(STORAGE_KEY), before); assert.equal(s.getDocument(), document);
});

test('a failed main write leaves its previous snapshot; conflicts create none', () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = open({ ...backing, setItem(k,v) { if (k === STORAGE_KEY) throw quotaError(); backing.setItem(k,v); } });
  assert.throws(() => s.updateIngredient('i1', { name: 'Not saved' }), { code: 'quota' });
  assert.equal(s.listHistory()[0].raw, backing.getItem(STORAGE_KEY));
  const stale = open(backing); open(backing).resetToEmpty();
  const history = stale.listHistory();
  assert.throws(() => stale.resetToEmpty(), { code: 'conflict' });
  assert.deepEqual(stale.listHistory(), history);
});

test('corrupt main data can restore a valid snapshot but an invalid snapshot is rejected', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = open(storage); s.resetToEmpty(); const entry = s.listHistory()[0];
  storage.setItem(STORAGE_KEY, '{bad');
  const recovery = createStore(storage, { demo: smallDocument(), now: () => DEMO_NOW });
  assert.throws(() => recovery.load());
  recovery.restoreHistory(entry.id);
  assert.deepEqual(recovery.getDocument(), smallDocument());
  const damaged = recovery.listHistory().find(e => e.raw === '{bad');
  const before = storage.getItem(STORAGE_KEY);
  assert.throws(() => recovery.restoreHistory(damaged.id));
  assert.equal(storage.getItem(STORAGE_KEY), before);
});

test('backup reminder starts with own changes, waits seven days and resets after Export', () => {
  let clock = Date.parse(DEMO_NOW);
  const storage = memoryStorage();
  const s = createStore(storage, { demo: smallDocument(), now: () => clock }); s.load();
  assert.equal(s.getBackupStatus().due, false);
  clock += 8*86400000; assert.equal(s.getBackupStatus().due, false);
  s.updateIngredient('i1', { name: 'My ingredient' });
  clock += 6*86400000; assert.equal(s.getBackupStatus().due, false);
  clock += 86400000; assert.equal(s.getBackupStatus().due, true);
  s.recordExport(); assert.equal(s.getBackupStatus().due, false);
  assert.equal(s.getBackupStatus().lastExportAt, new Date(clock).toISOString());
  clock += 7*86400000; assert.equal(s.getBackupStatus().due, true);
  s.resetToDemo(); assert.equal(s.getBackupStatus().due, false);
});

test('memory recovery requires absent current storage and uses normal persistence', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  const s = open(storage); storage.removeItem(STORAGE_KEY); s.saveMemoryAsNew();
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), smallDocument());
  assert.throws(() => s.saveMemoryAsNew(), { code: 'conflict' });
});

test('large histories evict by UTF-16 size before the ten-version limit', () => {
  const doc = smallDocument();
  doc.ingredients.push(...Array.from({ length: 500 }, (_, i) => ({ ...doc.ingredients[0], id: `bulk${i}`, name: 'Ingredient '.repeat(8) })));
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) }), s = open(storage);
  for (let i = 0; i < 12; i++) s.updateIngredient('i1', { name: `Name ${i}` });
  assert.ok(s.listHistory().length > 0 && s.listHistory().length < 10);
  const size = [...storage.data].filter(([k]) => k.startsWith('menupilot:history:')).reduce((n,[k,v]) => n+2*(k.length+v.length),0);
  assert.ok(size <= 1024*1024);
});

test('storage quota evicts oldest snapshots, but never the just-archived current version', () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let budget = Infinity;
  const storage = { ...backing, setItem(k,v) {
    const next = new Map(backing.data); next.set(k,v);
    if ([...next].reduce((n,[key,value]) => n+2*(key.length+value.length),0) > budget) throw quotaError();
    backing.setItem(k,v);
  } };
  const s = open(storage); s.updateIngredient('i1', { name: 'First' }); s.updateIngredient('i1', { name: 'Second' });
  const size = [...backing.data].reduce((n,[k,v]) => n+2*(k.length+v.length),0);
  budget = size + 100;
  const previous = backing.getItem(STORAGE_KEY);
  s.updateIngredient('i1', { name: 'Third' });
  assert.equal(s.listHistory()[0].raw, previous);
  assert.ok(s.listHistory().length <= 2);
});

test('destructive replacements refuse when no previous snapshot can be stored', () => {
  for (const action of [s => s.resetToEmpty(), s => s.resetToDemo(), s => s.importJSON(JSON.stringify(smallDocument())), s => s.restoreHistory(s.listHistory()[0].id)]) {
    const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
    open(backing).updateIngredient('i1', { name: 'Own changed data' });
    const s = open({ ...backing, setItem(k,v) { if (k.startsWith('menupilot:history:')) throw quotaError(); backing.setItem(k,v); } });
    const before = backing.getItem(STORAGE_KEY);
    assert.throws(() => action(s), { code: 'quota' });
    assert.equal(backing.getItem(STORAGE_KEY), before);
  }
});

test('a snapshot exceeding one MiB warns while the ordinary document save still succeeds', () => {
  const doc = smallDocument();
  doc.ingredients.push(...Array.from({ length: 1998 }, (_, i) => ({ ...doc.ingredients[0], id: `large${i}`, name: 'Long name '.repeat(10) })));
  const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(doc) }), s = open(storage);
  s.updateIngredient('i1', { name: 'Saved without snapshot' });
  assert.equal(s.getHistoryWarning(), true); assert.equal(s.listHistory().length, 0);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).ingredients[0].name, 'Saved without snapshot');
});

test('identical saves do not write, archive, or evict genuine versions', () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let writes = 0;
  const s = open({ ...backing, setItem(k,v) { writes++; backing.setItem(k,v); } });
  s.updateIngredient('i1', { name: 'Actual change' });
  const history = s.listHistory(), before = writes, document = s.getDocument();
  for (let i = 0; i < 10; i++) s.save(document);
  assert.equal(writes, before);
  assert.deepEqual(s.listHistory(), history);
});

test('retry after failed main write does not duplicate the newest snapshot', () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let fail = true;
  const s = open({ ...backing, setItem(k,v) { if (fail && k === STORAGE_KEY) throw new Error('failed'); backing.setItem(k,v); } });
  assert.throws(() => s.updateIngredient('i1', { name: 'Changed' }));
  const history = s.listHistory(); fail = false;
  s.updateIngredient('i1', { name: 'Changed' });
  assert.deepEqual(s.listHistory(), history);
});

test('restoring the oldest of a full history preserves that snapshot on main-write failure and quota eviction', () => {
  for (const failure of [new Error('failed'), quotaError()]) {
    const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
    let fail = false;
    const s = open({ ...backing, setItem(k,v) { if (fail && k === STORAGE_KEY) throw failure; backing.setItem(k,v); } });
    for (let i = 0; i < 10; i++) s.updateIngredient('i1', { name: `Version ${i}` });
    const oldest = s.listHistory().at(-1), current = backing.getItem(STORAGE_KEY);
    fail = true;
    assert.throws(() => s.restoreHistory(oldest.id));
    assert.equal(backing.getItem(STORAGE_KEY), current);
    assert.ok(s.listHistory().some(e => e.id === oldest.id && e.raw === oldest.raw));
    assert.ok(s.listHistory().some(e => e.raw === current));
    fail = false; s.restoreHistory(oldest.id);
    assert.equal(backing.getItem(STORAGE_KEY), oldest.raw);
  }
});

test('archive quota never evicts the version being restored', () => {
  const backing = memoryStorage({ [STORAGE_KEY]: JSON.stringify(smallDocument()) });
  let failHistory = false;
  const s = open({ ...backing, setItem(k,v) { if (failHistory && k.startsWith('menupilot:history:')) throw quotaError(); backing.setItem(k,v); } });
  for (let i = 0; i < 10; i++) s.updateIngredient('i1', { name: `Version ${i}` });
  const oldest = s.listHistory().at(-1), current = backing.getItem(STORAGE_KEY);
  failHistory = true;
  assert.throws(() => s.restoreHistory(oldest.id), { code: 'quota' });
  assert.equal(backing.getItem(STORAGE_KEY), current);
  assert.ok(s.listHistory().some(e => e.id === oldest.id));
});
