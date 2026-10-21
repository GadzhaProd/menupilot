import { encoded, decoded } from './fixtures.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, readDemo, DEMO_NOW } from './fixtures.js';
const open = (storage) => createStore(storage, { demo: readDemo(), now: () => DEMO_NOW });

test('stale rename cannot remove another tab’s appended price', async () => {
  const storage = memoryStorage();
  const a = (await open(storage)), b = (await open(storage));
  (await a.load()); (await b.load());
  (await a.addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 }));
  const saved = storage.getItem(STORAGE_KEY);
  (await assert.rejects(async () => (await b.updateIngredient('ing_beef', { name: 'Renamed' })), { code: 'conflict' }));
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.notEqual(b.getDocument().ingredients[0].name, 'Renamed');
  (await b.load());
  (await b.updateIngredient('ing_beef', { name: 'Renamed' }));
  const beef = decoded(storage.getItem(STORAGE_KEY)).ingredients.find(i => i.id === 'ing_beef');
  assert.equal(beef.prices.at(-1).packPriceCents, 1800);
  assert.equal(beef.name, 'Renamed');
});

test('stale import and resets also cannot replace newer data', async () => {
  for (const command of [async s => (await s.importJSON(JSON.stringify(readDemo()))), async s => (await s.resetToDemo()), async s => (await s.resetToEmpty())]) {
    const storage = memoryStorage();
    const a = (await open(storage)), b = (await open(storage));
    (await a.load()); (await b.load()); (await a.resetToEmpty());
    const saved = storage.getItem(STORAGE_KEY);
    (await assert.rejects(() => command(b), { code: 'conflict' }));
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('recovery validates before replacing raw data and still checks conflicts', async () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{bad' });
  const s = (await open(storage));
  (await assert.rejects(async () => (await s.load()), { code: 'corrupt-json' }));
  (await assert.rejects(async () => (await s.importJSON('{bad backup')), { code: 'corrupt-json' }));
  assert.equal(storage.getItem(STORAGE_KEY), '{bad');
  (await s.importJSON(JSON.stringify(readDemo())));
  assert.equal(s.getDocument().version, 1);
  const other = (await open(storage)); (await other.load()); (await other.resetToEmpty());
  (await assert.rejects(async () => (await s.resetToDemo()), { code: 'conflict' }));
});

test('existing v1 documents remain readable without rewriting', async () => {
  const raw = JSON.stringify(readDemo());
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  assert.equal((await (await open(storage)).load()).version, 1);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('failed reload does not authorize overwriting a newly damaged document', async () => {
  const storage = memoryStorage();
  const s = (await open(storage)); (await s.load());
  storage.setItem(STORAGE_KEY, '{new damage');
  (await assert.rejects(async () => (await s.load()), { code: 'corrupt-json' }));
  (await assert.rejects(async () => (await s.updateIngredient('ing_beef', { name: 'Old draft' })), { code: 'conflict' }));
  assert.equal(storage.getItem(STORAGE_KEY), '{new damage');
});
