import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { assertValidDocument } from '../../src/store/schema.js';
import { selectPriceAtDate } from '../../src/calc/costing.js';
import { encoded, smallDocument, memoryStorage } from './fixtures.js';

export function backdatedDocument() {
  const doc = smallDocument();
  doc.ingredients[0].prices.push({ seq: 2, recordedAt: '2025-12-31T00:00:00.000Z', packPriceCents: 100, packSizeMilli: 500000 });
  return doc;
}
test('browser: unsorted price dates can import/export; edits, deletions and reordering remain forbidden', async () => {
  const demo = smallDocument();
  const store = createStore(memoryStorage({ [STORAGE_KEY]: encoded(demo) }), { demo, now: () => '2026-11-01T12:00:00Z' });
  await store.load();
  const doc = backdatedDocument();
  assertValidDocument(doc);
  const imported = await store.importJSON(JSON.stringify(doc));
  assert.deepEqual(imported, doc);
  assert.deepEqual(store.previewImport(await store.exportJSON()), doc);
  assert.equal(selectPriceAtDate(imported.ingredients[0].prices).seq, 1);
  for (const mutate of [
    d => { d.ingredients[0].prices[0].packPriceCents++; },
    d => { d.ingredients[0].prices.shift(); },
    d => { d.ingredients[0].prices.pop(); },
    d => { d.ingredients[0].prices.reverse(); d.ingredients[0].prices.forEach((p, i) => { p.seq = i + 1; }); },
  ]) {
    const candidate = structuredClone(imported); mutate(candidate);
    await assert.rejects(store.save(candidate), { code: 'invalid-transition' });
    assert.equal(store.getDocument(), imported);
  }
});
