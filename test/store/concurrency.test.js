import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, readDemo, DEMO_NOW } from './fixtures.js';
const open = (storage) => createStore(storage, { demo: readDemo(), now: () => DEMO_NOW });

test('stale rename cannot remove another tab’s appended price', () => {
  const storage = memoryStorage();
  const a = open(storage), b = open(storage);
  a.load(); b.load();
  a.addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 });
  const saved = storage.getItem(STORAGE_KEY);
  assert.throws(() => b.updateIngredient('ing_beef', { name: 'Renamed' }), { code: 'conflict' });
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  assert.notEqual(b.getDocument().ingredients[0].name, 'Renamed');
  b.load();
  b.updateIngredient('ing_beef', { name: 'Renamed' });
  const beef = JSON.parse(storage.getItem(STORAGE_KEY)).ingredients.find(i => i.id === 'ing_beef');
  assert.equal(beef.prices.at(-1).packPriceCents, 1800);
  assert.equal(beef.name, 'Renamed');
});

test('stale import and resets also cannot replace newer data', () => {
  for (const command of [s => s.importJSON(JSON.stringify(readDemo())), s => s.resetToDemo(), s => s.resetToEmpty()]) {
    const storage = memoryStorage();
    const a = open(storage), b = open(storage);
    a.load(); b.load(); a.resetToEmpty();
    const saved = storage.getItem(STORAGE_KEY);
    assert.throws(() => command(b), { code: 'conflict' });
    assert.equal(storage.getItem(STORAGE_KEY), saved);
  }
});

test('recovery validates before replacing raw data and still checks conflicts', () => {
  const storage = memoryStorage({ [STORAGE_KEY]: '{bad' });
  const s = open(storage);
  assert.throws(() => s.load(), { code: 'corrupt-json' });
  assert.throws(() => s.importJSON('{bad backup'), { code: 'corrupt-json' });
  assert.equal(storage.getItem(STORAGE_KEY), '{bad');
  s.importJSON(JSON.stringify(readDemo()));
  assert.equal(s.getDocument().version, 1);
  const other = open(storage); other.load(); other.resetToEmpty();
  assert.throws(() => s.resetToDemo(), { code: 'conflict' });
});

test('existing v1 documents remain readable without rewriting', () => {
  const raw = JSON.stringify(readDemo());
  const storage = memoryStorage({ [STORAGE_KEY]: raw });
  assert.equal(open(storage).load().version, 1);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});

test('failed reload does not authorize overwriting a newly damaged document', () => {
  const storage = memoryStorage();
  const s = open(storage); s.load();
  storage.setItem(STORAGE_KEY, '{new damage');
  assert.throws(() => s.load(), { code: 'corrupt-json' });
  assert.throws(() => s.updateIngredient('ing_beef', { name: 'Old draft' }), { code: 'conflict' });
  assert.equal(storage.getItem(STORAGE_KEY), '{new damage');
});
