import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, readDemo, DEMO_NOW, quotaError } from './fixtures.js';

const translatedDemo = () => { const demo = readDemo(); demo.recipes[2].name = 'Klassieke burger'; return demo; };
test('resetToDemo accepts a translated document, persists it and keeps caller input intact', () => {
  const storage = memoryStorage();
  const store = createStore(storage, { demo: readDemo(), now: () => DEMO_NOW });
  store.load();
  const translated = translatedDemo();
  const copy = structuredClone(translated);
  assert.equal(store.resetToDemo(translated).recipes[2].name, 'Klassieke burger');
  assert.deepEqual(translated, copy);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).recipes[2].name, 'Klassieke burger');
  assert.equal(store.resetToDemo().recipes[2].name, 'Classic Burger');
});
test('invalid or unwritable translated demo leaves document and storage untouched', () => {
  const storage = memoryStorage();
  const store = createStore(storage, { demo: readDemo(), now: () => DEMO_NOW });
  const before = store.resetToDemo();
  const raw = storage.getItem(STORAGE_KEY);
  const invalid = translatedDemo(); invalid.recipes[2].menuPriceInclVatCents = -1;
  assert.throws(() => store.resetToDemo(invalid));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  storage.failOnSet = quotaError();
  assert.throws(() => store.resetToDemo(translatedDemo()), { code: 'quota' });
  assert.equal(store.getDocument(), before);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test('EN and NL demo differ only in nonempty names, never IDs, numbers, dates or structure', () => {
  const nl = JSON.parse(readFileSync(new URL('../../data/demo.nl.json', import.meta.url), 'utf8'));
  const en = readDemo();
  const stripNames = (value) => Array.isArray(value) ? value.map(stripNames)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'name').map(([key, item]) => [key, stripNames(item)])) : value;
  assert.deepEqual(stripNames(nl), stripNames(en));
  for (const key of ['ingredients', 'recipes']) nl[key].forEach((item, i) => {
    assert.ok(item.name.trim()); assert.notEqual(item.name, en[key][i].name);
  });
});
