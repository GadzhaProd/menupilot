// Run mutants in a disposable copy: never edit the checkout used by another test/server.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'menupilot-mutants-'));
try {
  for (const path of ['server', 'src', 'test/store', 'test/server', 'data']) {
    mkdirSync(join(dir, path, '..'), { recursive: true }); cpSync(path, join(dir,path), { recursive: true });
  }
  writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  const mutants = [
    ['CAS identity', 'server/sqlite.js', 'current.documentId === expectedDocumentId &&', '', 'test/server/sqlite.test.js'],
    ['append-only transition', 'server/sqlite.js', "if (input.kind === 'save') assertValidTransition(current.document, document);", '', 'test/server/sqlite.test.js'],
    ['receipt deduplication', 'server/sqlite.js', "db.prepare('SELECT hash, receipt FROM ops WHERE id=?').get(input.opId)", 'undefined', 'test/server/sqlite.test.js'],
    ['lock ownership', 'server/lock.js', 'current?.instanceId !== owner.instanceId || current.pid !== owner.pid', 'false', 'test/server/lock.test.js'],
    ['Host check', 'server/http.js', 'req.headers.host !== host', 'false', 'test/server/http.test.js'],
    ['token check', 'server/http.js', 'if (!source)', 'if (false)', 'test/server/http.test.js'],
  ];
  for (const [name, file, before, after, test] of mutants) {
    const path = join(dir,file), original = readFileSync(path,'utf8');
    if (!original.includes(before)) throw new Error(`Missing mutation target: ${name}`);
    writeFileSync(path, original.replace(before,after));
    const result = spawnSync(process.execPath,['--test',test],{cwd:dir,encoding:'utf8',timeout:30000});
    writeFileSync(path, original);
    if (result.status === 0 || result.error || !result.stdout.includes('fail')) throw new Error(`Mutation not caught: ${name}\n${result.stdout}\n${result.stderr}`);
    console.log(`CAUGHT: ${name}`);
  }
} finally { rmSync(dir,{recursive:true}); }
