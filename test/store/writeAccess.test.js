import test from 'node:test';
import assert from 'node:assert/strict';
import { withWriteLock, WRITE_LOCK } from '../../src/store/writeAccess.js';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, readDemo, DEMO_NOW } from './fixtures.js';

function locks() {
  let tail = Promise.resolve();
  return { request(name, callback) {
    assert.equal(name, WRITE_LOCK);
    const job = tail.then(() => callback({}));
    tail = job.catch(() => {});
    return job;
  } };
}

test('per-command locks serialize competing stores and reject the stale writer', async () => {
  const manager = locks(), storage = memoryStorage();
  const a = createStore(storage, { demo: readDemo(), now: () => DEMO_NOW, locks: manager });
  const b = createStore(storage, { demo: readDemo(), now: () => DEMO_NOW, locks: manager });
  await a.load(); await b.load();
  const results = await Promise.allSettled([
    a.addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 }),
    b.updateIngredient('ing_beef', { name: 'Stale' }),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].reason.code, 'conflict');
  const before = storage.getItem(STORAGE_KEY);
  await b.load(); await b.updateIngredient('ing_beef', { name: 'Fresh' });
  assert.notEqual(storage.getItem(STORAGE_KEY), before);
  assert.equal(b.getDocument().ingredients[0].prices.at(-1).packPriceCents, 1800);
});

test('missing Web Locks fails closed; rejected writes release the queue', async () => {
  let ran = false;
  await assert.rejects(withWriteLock(null, () => { ran = true; }), { code: 'write-unavailable' });
  assert.equal(ran, false);
  const manager = locks();
  await assert.rejects(withWriteLock(manager, () => { throw new Error('failed'); }));
  assert.equal(await withWriteLock(manager, () => 42), 42);
});
