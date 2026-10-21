import { encoded, decoded } from './fixtures.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, readDemo, DEMO_NOW, quotaError } from './fixtures.js';

const translatedDemo = () => { const demo = readDemo(); demo.recipes[2].name = 'Klassieke burger'; return demo; };
test('resetToDemo accepts a translated document, persists it and keeps caller input intact', async () => {
  const storage = memoryStorage();
  const store = createStore(storage, { demo: readDemo(), now: () => DEMO_NOW });
  (await store.load());
  const translated = translatedDemo();
  const copy = structuredClone(translated);
  assert.equal((await store.resetToDemo(translated)).recipes[2].name, 'Klassieke burger');
  assert.deepEqual(translated, copy);
  assert.equal(decoded(storage.getItem(STORAGE_KEY)).recipes[2].name, 'Klassieke burger');
  assert.equal((await store.resetToDemo()).recipes[2].name, 'Classic Burger');
});
test('invalid or unwritable translated demo leaves document and storage untouched', async () => {
  const storage = memoryStorage();
  const store = createStore(storage, { demo: readDemo(), now: () => DEMO_NOW });
  const before = (await store.resetToDemo());
  const raw = storage.getItem(STORAGE_KEY);
  const invalid = translatedDemo(); invalid.recipes[2].menuPriceInclVatCents = -1;
  (await assert.rejects(async () => (await store.resetToDemo(invalid))));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
  storage.failOnSet = quotaError();
  (await assert.rejects(async () => (await store.resetToDemo(translatedDemo())), { code: 'quota' }));
  assert.equal(store.getDocument(), before);
  assert.equal(storage.getItem(STORAGE_KEY), raw);
});
test('EN and NL demo differ only in nonempty names, never IDs, numbers, dates or structure', () => {
  const nl = decoded(readFileSync(new URL('../../data/demo.nl.json', import.meta.url), 'utf8'));
  const en = readDemo();
  const stripNames = (value) => Array.isArray(value) ? value.map(stripNames)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'name').map(([key, item]) => [key, stripNames(item)])) : value;
  assert.deepEqual(stripNames(nl), stripNames(en));
  for (const key of ['ingredients', 'recipes']) nl[key].forEach((item, i) => {
    assert.ok(item.name.trim()); assert.notEqual(item.name, en[key][i].name);
  });
});
