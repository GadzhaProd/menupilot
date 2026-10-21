import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/store/store.js';
import { DEMO_NOW } from './fixtures.js';

// Shared async fixtures own resource cleanup; no transport-specific assertions here.
export function storageAdapterContract(name, fixture) {
  const check = (label, run) => test(`${name}: ${label}`, async t => { const f = await fixture(); t.after(() => f.close?.()); await run(f); });
  check('CAS conflict returns latest revision and document', async ({open}) => {
    const a=await open(), b=await open(); const first=await a.load(); await b.load();
    const doc=structuredClone(first.document); doc.ingredients[0].name='Changed';
    const saved=await a.save(doc,first.revision,'save-1');
    const result=await b.save(first.document,first.revision,'save-2');
    assert.equal(result.conflict,true); assert.equal(result.revision,saved.revision);
    assert.deepEqual(result.document,doc);
  });
  check('wrong expected revision does not write', async ({open,readSaved}) => {
    const a=await open(), first=await a.load(), before=await readSaved();
    const result=await a.save(first.document,first.revision+1,'wrong');
    assert.equal(result.conflict,true); assert.equal(result.revision,first.revision); assert.equal(await readSaved(),before);
  });
  check('reads are detached and history lists metadata only', async ({open}) => {
    const a=await open(), first=await a.load(), original=structuredClone(first.document);
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
    const a=await open();await a.load();await assert.rejects(a.history.read('missing'),{code:'not-found'});
  });
  check('foreign import receives a fresh identity; same-dataset import keeps identity and advances revision', async ({open}) => {
    const a=await open();const first=await a.load();const one=await a.save(first.document,first.revision,'one');
    const two=await a.importDocument({...one,documentId:'foreign',revision:9000},one.revision,'foreign');
    assert.notEqual(two.documentId,'foreign');assert.notEqual(two.documentId,one.documentId);
    const three=await a.importDocument(two,two.revision,'same');
    assert.equal(three.documentId,two.documentId);assert.ok(three.revision>two.revision);
  });
  check('invalid imports are rejected by the common store before reaching the adapter', async ({open,readSaved}) => {
    const a=await open(); const first=await a.load(); const store=createStore(null,{adapter:a,demo:first.document,now:()=>DEMO_NOW});
    await store.load(); const before=await readSaved();
    for(const text of ['{bad',JSON.stringify({...first,version:2,schemaVersion:2,documentId:23})]) await assert.rejects(store.importJSON(text));
    assert.equal(await readSaved(),before);assert.deepEqual(store.getDocument(),first.document);
  });
  check('successful save and import opId retries survive reopening without another write', async ({open,readSaved}) => {
    const a=await open();const first=await a.load();const doc=structuredClone(first.document);doc.ingredients[0].name='Once';
    const one=await a.save(doc,first.revision,'repeat-save');const bytes=await readSaved();
    const reopened=await open();await reopened.load();const retry=await reopened.save(doc,first.revision,'repeat-save');
    assert.equal(retry.conflict,undefined);assert.equal(retry.revision,one.revision);assert.equal(await readSaved(),bytes);
    const two=await reopened.importDocument({...one,documentId:'foreign'},one.revision,'repeat-import');const imported=await readSaved();
    const other=await open();await other.load();const replay=await other.importDocument({...one,documentId:'foreign'},one.revision,'repeat-import');
    assert.equal(replay.conflict,undefined);assert.equal(replay.documentId,two.documentId);assert.equal(replay.revision,two.revision);assert.equal(await readSaved(),imported);
  });
  check('failed write leaves document unchanged and retry can succeed', async ({open,failWrites,readSaved}) => {
    const a=await open();const first=await a.load(), before=await readSaved();const doc=structuredClone(first.document);doc.ingredients[0].name='Retry';
    await failWrites(true);await assert.rejects(a.save(doc,first.revision,'retry'),{code:'write-failed'});assert.equal(await readSaved(),before);
    await failWrites(false);const saved=await a.save(doc,first.revision,'retry');assert.ok(saved.revision>first.revision);
  });
}
