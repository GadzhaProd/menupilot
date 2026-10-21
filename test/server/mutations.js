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
    ['cookie gate', 'server/http.js', 'session.hasCookie(req, cookieName)', 'true', 'test/server/security.test.js'],
    ['page cookie gate', 'server/http.js', 'const html = session.hasCookie(req, cookieName)', 'const html = true', 'test/server/security.test.js'],
    ['Origin check', 'server/http.js', 'req.headers.origin !== undefined && req.headers.origin !== address', 'false', 'test/server/security.test.js'],
    ['missing Origin check', 'server/http.js', "req.method !== 'GET' && req.headers.origin !== address && source !== 'cli'", 'false', 'test/server/security.test.js'],
    ['one-time launch secret', 'server/session.js', 'rotate(); // Invalidate', '// rotate(); // Invalidate', 'test/server/security.test.js'],
    ['frame protection', 'server/http.js', "frame-ancestors 'none'", "frame-ancestors 'self'", 'test/server/security.test.js'],
    ['streaming body budget', 'server/http.js', 'size > maxBytes', 'false', 'test/server/http.test.js'],
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
