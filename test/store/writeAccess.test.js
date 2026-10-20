import test from 'node:test';
import assert from 'node:assert/strict';
import { createWriteAccess } from '../../src/store/writeAccess.js';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { memoryStorage, readDemo, DEMO_NOW } from './fixtures.js';

// Model the Web Locks queue, including holding a lock until its callback resolves.
function locks() {
  let tail = Promise.resolve();
  return { request(_name, callback) {
    const job = tail.then(() => callback({}));
    tail = job.catch(() => {});
    return job;
  } };
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('exclusive leases serialize competing stores; stale queued writer is rejected', async () => {
  const manager = locks();
  const first = createWriteAccess(manager), second = createWriteAccess(manager);
  const storage = memoryStorage();
  const wrap = access => ({ getItem: key => storage.getItem(key), setItem(key, value) { access.assertWritable(); storage.setItem(key, value); } });
  const open = access => createStore(wrap(access), { demo: readDemo(), now: () => DEMO_NOW });
  const a = open(first), b = open(second);
  a.load(); b.load();
  await first.acquire();
  const pending = second.acquire();
  await tick();
  assert.throws(() => second.assertWritable(), { code: 'write-busy' });
  a.addPrice('ing_beef', { packPriceCents: 1800, packSizeMilli: 1_000_000 });
  const saved = storage.getItem(STORAGE_KEY);
  first.release();
  await pending;
  assert.throws(() => first.assertWritable(), { code: 'write-busy' });
  assert.throws(() => b.updateIngredient('ing_beef', { name: 'Stale' }), { code: 'conflict' });
  assert.equal(storage.getItem(STORAGE_KEY), saved);
  b.load(); b.updateIngredient('ing_beef', { name: 'Fresh' });
  second.release();
});

test('missing Web Locks fails closed; no timeout grants an unsafe lease', async () => {
  const access = createWriteAccess(null);
  await assert.rejects(access.acquire(), { code: 'write-unavailable' });
  assert.throws(() => access.assertWritable(), { code: 'write-unavailable' });
});

test('release cancels a queued request without allowing a later write', async () => {
  const manager = locks(), a = createWriteAccess(manager), b = createWriteAccess(manager);
  await a.acquire();
  const pending = b.acquire();
  b.release(); a.release();
  await pending;
  assert.throws(() => b.assertWritable(), { code: 'write-busy' });
});
