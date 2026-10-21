import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, STORAGE_KEY } from '../../src/store/store.js';
import { createBrowserStorageAdapter } from '../../src/store/browserAdapter.js';
import { parseBackup } from '../../src/store/serialization.js';
import { withWriteLock } from '../../src/store/writeAccess.js';
import { memoryStorage, smallDocument, DEMO_NOW } from './fixtures.js';
const open = storage => createStore(storage, { demo: smallDocument(), now: () => DEMO_NOW });
const PRE = 'menupilot:premigration-v1';
function largeV1() {
  const doc = smallDocument();
  doc.ingredients = Array.from({ length: 200 }, (_, i) => ({ ...doc.ingredients[0], id: `i${i + 1}`, prices: Array.from({length:28}, (_, j) => ({ ...doc.ingredients[0].prices[0], seq:j+1 })) }));
  return JSON.stringify(doc, null, 2);
}
test('migration preserves a >600k v1 source outside the 1 MiB history budget', async () => {
  const raw = largeV1(); assert.ok(raw.length > 600_000);
  const storage = memoryStorage({ [STORAGE_KEY]: raw }); const s = open(storage);
  await s.load(); await s.updateIngredient('i1', { name:'Migrated' });
  assert.equal(storage.getItem(PRE), raw);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).schemaVersion, 2);
  assert.equal(s.getDocument().ingredients[0].name, 'Migrated');
});
test('migration needs a downloaded exact-source confirmation when its separate backup fails', async () => {
  const raw = largeV1(); const backing = memoryStorage({ [STORAGE_KEY]:raw });
  const storage = {...backing,setItem(k,v){ if(k === PRE) throw new Error('full'); backing.setItem(k,v); }};
  const s = open(storage); await s.load();
  await assert.rejects(s.updateIngredient('i1',{name:'Retry'}), {code:'migration-backup-required'});
  assert.equal(storage.getItem(STORAGE_KEY),raw); assert.equal(storage.getItem('menupilot:revision'),null);
  assert.equal(s.browserRecovery.migrationSource(),raw);
  assert.throws(() => s.browserRecovery.confirmMigrationDownload('wrong'),{code:'conflict'});
  s.browserRecovery.confirmMigrationDownload(raw);
  await s.updateIngredient('i1',{name:'Retry'});
  assert.equal(s.getDocument().ingredients[0].name,'Retry');
});
test('export before the first write has no uncommitted identity; resets always issue a new identity', async () => {
  const storage = memoryStorage({[STORAGE_KEY]:JSON.stringify(smallDocument())});
  const a=open(storage), b=open(storage); await a.load(); await b.load();
  assert.equal(parseBackup(await a.exportJSON()).documentId,null);
  assert.equal(await a.exportJSON(),await b.exportJSON());
  await a.resetToEmpty(); const one=a.getDocumentId(); assert.ok(one);
  await a.resetToDemo(); const two=a.getDocumentId(); assert.notEqual(one,two);
  await a.resetToEmpty(); assert.notEqual(a.getDocumentId(),two);
});
test('memory-as-new refuses to overwrite another saved dataset', async () => {
  const storage=memoryStorage(); const a=open(storage); await a.load(); await a.save(smallDocument());
  const before=storage.getItem(STORAGE_KEY);
  await assert.rejects(a.saveMemoryAsNew(),{code:'conflict'}); assert.equal(storage.getItem(STORAGE_KEY),before);
});
test('envelope identity is validated independently of domain version', () => {
  for(const documentId of [null,'',23,{},'a'.repeat(201)]) assert.throws(()=>parseBackup(JSON.stringify({version:2,schemaVersion:2,documentId,revision:1,document:smallDocument()})),{code:'invalid'});
});
test('wrapped browser storage without an explicit isolated flag fails closed', async () => {
  const storage=memoryStorage(); delete storage.isolated;
  const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});
  try {
    const adapter=createBrowserStorageAdapter(storage,{initialDocument:smallDocument()});
    await adapter.load(); await assert.rejects(adapter.save(smallDocument(),0,'test'),{code:'write-unavailable'});
  } finally { if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator; }
});
test('lock timeout aborts only the waiting request and leaves work unexecuted', async () => {
  let ran=false, signal;
  const locks={request(name,options,work){ signal=options.signal; return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))); }};
  await assert.rejects(withWriteLock(locks,()=>{ran=true;},10),{code:'write-busy'});
  assert.equal(signal.aborted,true); assert.equal(ran,false);
});
test('IDs are allocated lazily and HTTP-context crypto uses getRandomValues', async () => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,'crypto'); const original=globalThis.crypto;
  let calls=0;
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues(bytes){calls++;return original.getRandomValues(bytes);}}});
  try {
    const s=open(memoryStorage());await s.load();await s.exportJSON();assert.equal(calls,0);
    await s.resetToEmpty();assert.match(s.getDocumentId(),/^[a-f0-9-]{36}$/);assert.ok(calls>0);
  } finally {Object.defineProperty(globalThis,'crypto',previous);}
});
test('changing envelope identity to an invalid string is rejected even with valid domain data',()=>{
  const text=JSON.stringify({version:2,schemaVersion:2,documentId:'',revision:1,document:smallDocument()});
  assert.throws(()=>parseBackup(text),{code:'invalid'});
});

test('a valid document exceeding the serialized read limit is refused before storage changes', async () => {
  const doc=smallDocument();
  doc.ingredients=Array.from({length:100},(_,i)=>({...doc.ingredients[0],id:`i${i+1}`,prices:Array.from({length:600},(_,j)=>({...doc.ingredients[0].prices[0],seq:j+1}))}));
  assert.ok(JSON.stringify(doc).length>5_000_000);
  const storage=memoryStorage();const s=open(storage);await s.load();const before=s.getDocument();
  await assert.rejects(s.save(doc),{code:'invalid'});
  assert.equal(s.getDocument(),before);assert.equal(storage.getItem(STORAGE_KEY),null);
});
