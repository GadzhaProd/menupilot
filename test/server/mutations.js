// Run mutants in a disposable copy: never edit the checkout used by another test/server.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const dir = mkdtempSync(join(tmpdir(), 'menupilot-mutants-'));
try {
  for (const path of ['server', 'src', 'test/store', 'test/server', 'test/ui', 'vitest.config.js', 'tsconfig.json', 'data', 'README.md', 'docs/planning']) {
    mkdirSync(join(dir, path, '..'), { recursive: true }); cpSync(path, join(dir,path), { recursive: true });
  }
  writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  symlinkSync(join(process.cwd(), 'node_modules'), join(dir, 'node_modules'), 'dir');
  const mutants = [
    ['obsolete launch file cleanup', 'server/session.js', "unlinkSync(join(dir, 'launch-secret'));", '', 'test/server/review.test.js'],
    ['plan card VAT label', 'src/ui/data/LocalPlans.tsx', " · {t('common.exclVat')}", '', 'test/ui/plans.test.tsx'],
    ['plan approval UI gate', 'server/http.js', "['apply', 'reject'].includes(action) && source !== 'ui'", 'false', 'test/server/plans.test.js'],
    ['plan revision gate', 'server/plans.js', 'plan.revision !== current.revision', 'false', 'test/server/plans.test.js'],
    ['plan identity gate', 'server/plans.js', 'plan.documentId !== current.documentId', 'false', 'test/server/plans.test.js'],
    ['plan expiry', 'server/plans.js', 'Date.parse(plan.expiresAt) <= time', 'false', 'test/server/plans.test.js'],
    ['plan replay', 'server/plans.js', "if (plan.status === 'applied') return", "if (false) return", 'test/server/plans.test.js'],
    ['plan atomic commit', 'server/plans.js', "plan.status = 'applied';", "db.exec('COMMIT'); plan.status = 'applied';", 'test/server/plans.test.js'],
    ['plan pending budget', 'server/plans.js', "plans.filter(p => p.status === 'pending').length - supersedes.length >= PLAN_LIMITS.pending", 'false', 'test/server/plans.test.js'],
    ['plan byte budget', 'server/plans.js', 'bytes > PLAN_LIMITS.singleBytes', 'false', 'test/server/plans.test.js'],
    ['plan effect direction', 'server/planEffects.js', 'monthlyImpactCents(monthly(row), monthly(old))', 'monthlyImpactCents(monthly(old), monthly(row))', 'test/server/plans.test.js'],
    ["plan rejection gate", "server/plans.js", "      pending(plan);\n      return transaction(() => { plan.status = 'rejected';", "      return transaction(() => { plan.status = 'rejected';", "test/server/plans.test.js"],
    ["plan repeat rejection", "server/plans.js", "if (plan.status === 'rejected') return plan;", "if (false) return plan;", "test/server/plans.test.js"],
    ["plan fixed recordedAt", "server/plans.js", "}, plan.price.recordedAt);", "}, timestamp());", "test/server/plans.test.js"],
    ["plan no-volume exclusion", "server/planEffects.js", "row.monthlyVolume === null ? 'no-volume'", "row.monthlyVolume === null ? null", "test/server/plans.test.js"],
    ["plan unknown exclusion", "server/planEffects.js", "impact === null ? 'cost-unknown'", "impact === null ? null", "test/server/plans.test.js"],
    ["plan replacement", "server/plans.js", "old.status = 'superseded';", "old.status = 'pending';", "test/server/plans.test.js"],
    ["plan price ceiling", "server/plans.js", "packPriceCents > 10_000_000", "false", "test/server/plans.test.js"],
    ["plan zero warning", "server/plans.js", "packPriceCents === 0", "false", "test/server/plans.test.js"],
    ["plan ratio warning", "server/plans.js", "next > previous * 3n || previous > next * 3n", "false", "test/server/plans.test.js"],
    ["plan journal identity", "server/plans.js", "planId: plan.id, ingredientId: plan.ingredient.id", "", "test/server/plans.test.js"],
    ["plan conflict status", "server/plans.js", "status: 409", "status: 400", "test/server/plans.test.js"],
    ['plan compatible unit', 'server/plans.js', 'quantity.unit !== target.unit', 'false', 'test/server/plans.test.js'],

    ['retention restore-test', 'server/backupFiles.js', 'await verifyOrQuarantine(dir, entry.id)', '{ metadata: entry }', 'test/server/backup-retention.test.js'],
    ['retention verified spare', 'server/backupFiles.js', 'verified.slice(0, 2)', 'verified.slice(0, 1)', 'test/server/backup-retention.test.js'],
    ['retention clock pause', 'server/backups.js', 'observe(); return clockWarning;', 'observe(); return false;', 'test/server/backup-retention.test.js'],
    ['forward clock detection', 'server/backups.js', 'Math.abs((wall - lastWall) - (mono - lastMono)) > 60000', 'false', 'test/server/backup-retention.test.js'],
    ['daily monotonic scheduling', 'server/backups.js', 'monotonic() >= dailyDue', 'now() - Date.parse(latest.createdAt) >= DAY_MS', 'test/server/backup-retention.test.js'],
    ['persistent clock pause', 'server/backups.js', "put(db, 'backupClockWarning', '1');", '', 'test/server/backup-retention.test.js'],
    ['backup writer queue', 'server/backups.js', 'const result = queue.then(fn)', 'const result = Promise.resolve().then(fn)', 'test/server/backups.test.js'],
    ['snapshot metadata revision', 'server/backupFiles.js', 'manifest.revision !== record.revision || ', '', 'test/server/backups.test.js'],
    ['backup dirty marking', 'server/sqlite.js', "VALUES ('backupDirty','1') ON CONFLICT(key) DO UPDATE SET value='1'", "VALUES ('backupDirty','0') ON CONFLICT(key) DO UPDATE SET value='0'", 'test/server/backups.test.js'],
    ['pre-replacement snapshot', 'server/backups.js', "await capture('before-' + input.kind)", 'undefined', 'test/server/backups.test.js'],
    ['startup dirty snapshot', 'server/backups.js', "await capture('startup')", 'undefined', 'test/server/backups.test.js'],
    ['shutdown dirty snapshot', 'server/backups.js', "await capture('shutdown')", 'undefined', 'test/server/backups.test.js'],
    ['stop API requires POST', 'server/http.js', "req.method === 'POST' && path === '/api/stop'", "path === '/api/stop'", 'test/server/http.test.js'],
    ['stop API requires CLI token', 'server/http.js', "else if (req.method === 'POST' && path === '/api/stop') {\n          if (source !== 'cli') { send(res, 403, { code: 'cli-required'", "else if (req.method === 'POST' && path === '/api/stop') {\n          if (false) { send(res, 403, { code: 'cli-required'", 'test/server/http.test.js'],
    ['stop request initiates shutdown', 'server/http.js', 'setImmediate(requestStop);', 'undefined;', 'test/server/http.test.js'],
    ['stop waits for writer close', 'server/startLocal.js', 'await storage?.close()', 'storage?.close()', 'test/server/process.test.js'],
    ['stop releases writer lock', 'server/startLocal.js', 'await lock.release()', 'undefined', 'test/server/process.test.js'],
    ['backup restore revision', 'server/sqlite.js', 'revision: current.revision + 1', "revision: current.revision + (input.kind === 'backup-restore' ? 0 : 1)", 'test/server/backups.test.js'],
    ['snapshot integrity check', 'server/backupFiles.js', "integrity.length !== 1 || integrity[0].integrity_check !== 'ok'", 'false', 'test/server/backups.test.js'],
    ['snapshot retention budget', 'server/backupFiles.js', 'entries.length >= budget.count', 'false', 'test/server/backups.test.js'],
    ['external retry backoff', 'server/backups.js', 'monotonic() < retryAt', 'false', 'test/server/backups.test.js'],
    ['automatic deadline', 'server/backups.js', '4 * 60 * 1000', '6 * 60 * 1000', 'test/server/backups.test.js'],
    ['snapshot restore-test', 'server/backupFiles.js', 'const checked = inspectDatabase(destination);', 'const checked = { record: {}, metadata: { id } };', 'test/server/backups.test.js'],
    ['emergency startup guard', 'server/backups.js', "if (existsSync(join(dir, 'recovery-pending.json')))", 'if (false)', 'test/server/backups.test.js'],
    ['CAS identity', 'server/sqlite.js', 'current.documentId === expectedDocumentId &&', '', 'test/server/sqlite.test.js'],
    ['append-only transition', 'server/sqlite.js', "if (input.kind === 'save') assertValidTransition(current.document, document);", '', 'test/server/sqlite.test.js'],
    ['receipt deduplication', 'server/sqlite.js', "db.prepare('SELECT hash, receipt FROM ops WHERE id=?').get(input.opId)", 'undefined', 'test/server/sqlite.test.js'],
    ['lock ownership', 'server/lock.js', 'current?.instanceId !== owner.instanceId || current.pid !== owner.pid', 'false', 'test/server/lock.test.js'],
    ['config token gate', 'server/http.js', "session.authorize(req.headers.authorization?.replace(/^Bearer /, ''))", 'true', 'test/server/review.test.js'],
    ['page cookie gate', 'server/http.js', 'const html = session.hasCookie(req, cookieName)', 'const html = true', 'test/server/security.test.js'],
    ['Origin check', 'server/http.js', 'req.headers.origin !== undefined && req.headers.origin !== address', 'false', 'test/server/security.test.js'],
    ['missing Origin check', 'server/http.js', "req.method !== 'GET' && req.headers.origin !== address && source !== 'cli'", 'false', 'test/server/security.test.js'],
    ['one-time launch secret', 'server/session.js', 'rotate(); // Invalidate', '// rotate(); // Invalidate', 'test/server/security.test.js'],
    ['frame protection', 'server/http.js', "frame-ancestors 'none'", "frame-ancestors 'self'", 'test/server/security.test.js'],
    ['streaming body budget', 'server/http.js', 'size > maxBytes', 'false', 'test/server/http.test.js'],
    ['Host check', 'server/http.js', 'req.headers.host !== host', 'false', 'test/server/http.test.js'],
    ['token check', 'server/http.js', 'if (!source)', 'if (false)', 'test/server/http.test.js'],
    ['documented DoS boundary', 'README.md', 'Local DoS remains possible', 'Local DoS is prevented', 'test/server/security-docs.test.js'],
    ['documented history boundary', 'README.md', 'not** guarantee erasure from browser history or sync', 'guarantee erasure', 'test/server/security-docs.test.js'],
    ['static snapshot', 'server/http.js', "res.end(req.method === 'HEAD' ? undefined : file.body)", "res.end(req.method === 'HEAD' ? undefined : readFileSync(join(root, path.slice('/menupilot/'.length))))", 'test/server/review.test.js'],
    ['sent header guard', 'server/http.js', 'if (res.headersSent) { res.destroy(); return; }', '', 'test/server/review.test.js'],
    ['async handler boundary', 'server/http.js', '.catch(error => handleRequestError(req, res, error))', '', 'test/server/review.test.js'],
    ['login byte budget', 'server/http.js', 'jsonBody(req, 1024)', 'jsonBody(req)', 'test/server/review.test.js'],
    ['duplicate cookie', 'server/session.js', 'values.length === 1 &&', '', 'test/server/review.test.js'],
    ['requests per socket', 'server/http.js', 'server.maxRequestsPerSocket = 100', 'server.maxRequestsPerSocket = 0', 'test/server/review.test.js'],
    ['keepalive deadline', 'server/http.js', 'server.keepAliveTimeout = policy.keepAliveMs', 'server.keepAliveTimeout = 0', 'test/server/review.test.js'],
    ['static methods', 'server/http.js', "req.method !== 'GET' && req.method !== 'HEAD'", 'false', 'test/server/review.test.js'],
    ['link expiry', 'server/session.js', ' || now() - issuedAt >= LAUNCH_TTL_MS', '', 'test/server/review.test.js'],
    ['absolute expiry', 'server/session.js', 'now() - record.createdAt < SESSION_ABSOLUTE_MS &&', '', 'test/server/review.test.js'],
    ['idle expiry', 'server/session.js', 'now() - record.lastUsed < SESSION_IDLE_MS', 'true', 'test/server/review.test.js'],
    ['CLI revocation flag', 'server/cli.js', "args[1] === '--revoke-sessions'", 'false', 'test/server/review.test.js'],
    ['CLI Dashboard monthly impact', 'src/calc/dashboard.js', 'monthlyImpactCents(current.monthlyContributionCents, historical.monthlyContributionCents)', 'monthlyImpactCents(historical.monthlyContributionCents, current.monthlyContributionCents)', 'test/server/cli.test.js'],
    ['CLI scenario delta direction', 'server/cliRead.js', 'a - b;', 'b - a;', 'test/server/cli.test.js'],
    ['CLI token mode', 'server/cli.js', 'mode !== 0o600', 'mode === 0o600', 'test/server/cli.test.js'],
    ['CLI token mode disabled', 'server/cli.js', 'mode !== 0o600', 'false', 'test/server/cli.test.js'],
    ['CLI open response allows capability fields', 'server/cliSecurity.js', "Object.keys(result).length === 1", 'true', 'test/server/cli.test.js'],
    ['CLI doctor quick_check disabled', 'server/cliRead.js', "rows.length !== 1 || rows[0].quick_check !== 'ok'", 'false', 'test/server/cli.test.js'],
    ['CLI human candidates disabled', 'server/cli.js', 'for (const candidate of error.candidates ?? [])', 'for (const candidate of [])', 'test/server/cli.test.js'],
    ['CLI Dashboard 30 day window', 'server/cliRead.js', 'date.setTime(date.getTime() - days * 86400000)', 'date.setTime(date.getTime())', 'test/server/cli.test.js'],
    ['CLI not-found exit code', 'server/cli.js', "'not-found': 4, ambiguous: 4", "'not-found': 1, ambiguous: 4", 'test/server/cli.test.js'],
    ['CLI safe volume integer', 'server/cliRead.js', 'Number.isSafeInteger(value)', 'Number.isInteger(value)', 'test/server/cli.test.js'],
    ['CLI quantity decimal comma', 'server/cliRead.js', String.raw`\d+(?:[.,]`, String.raw`\d+(?:[.]`, 'test/server/cli.test.js'],
    ['CLI no-volume total', 'src/calc/dashboard.js', 'dishesWithVolume.length === 0 ? null : menuMonthlyImpactCents(knownImpacts)', 'dishesWithVolume.length === 0 ? menuMonthlyImpactCents(knownImpacts) : menuMonthlyImpactCents(knownImpacts)', 'test/server/cli.test.js'],
    ['CLI locale formatting', 'server/cliRead.js', 'formatEURFromCentsLocale(value, locale)', "formatEURFromCentsLocale(value, 'en')", 'test/server/cli.test.js'],
    ['CLI substring suggestion', 'server/cliRead.js', 'candidate.contains || candidate.d <=', 'candidate.d <=', 'test/server/cli.test.js'],
    ['CLI lock diagnostic', 'server/cliRead.js', '!owner || apiAvailable', 'true', 'test/server/cli.test.js'],
    ['CLI port diagnostic', 'server/cliRead.js', 'validPort && (apiAvailable || !busy)', 'validPort', 'test/server/cli.test.js'],
    ['CLI supported Node range', 'server/cliRead.js', '(major === 24 && minor >= 15) || (major === 25 && (minor > 8 || (minor === 8 && patch >= 1)))', 'true', 'test/server/cli.test.js'],
    ['distinct session tokens', 'server/session.js', "const token = randomBytes(32).toString('hex'), cookie", "const token = 'a'.repeat(64), cookie", 'test/server/review.test.js'],
    ['CLI launch capability leak', 'server/http.js', 'value = { opened: await openBrowser(`${address}/menupilot/#k=${key}`) };', 'value = { url: `${address}/menupilot/#k=${key}` };', 'test/server/review.test.js'],
    ['link rotation', 'server/http.js', 'session.rotate(body.revokeSessions === true)', 'session.key', 'test/server/review.test.js'],
    ['session revocation', 'server/session.js', 'if (revokeSessions) sessions.clear();', '', 'test/server/review.test.js'],
    ['warn default', 'server/log.js', "?? 'warn'", "?? 'info'", 'test/server/review.test.js'],
    ['denial reason', 'server/log.js', '...(reason && { reason })', '', 'test/server/review.test.js'],
    ['localhost help', 'server/http.js', "res.writeHead(403, { 'Content-Type': MIME['.html'] })", "res.writeHead(403, { 'Content-Type': 'application/json' })", 'test/server/review.test.js'],
    ['ingredient audit name', 'server/sqlite.js', 'name: i.name, priceEntries:', 'priceEntries:', 'test/server/sqlite.test.js'],
    ['sessionStorage bearer', 'server/login.js', "sessionStorage.setItem('menupilot.local.token.v1', token);", '', 'test/server/security.test.js'],
    ...[
      ["script-src 'self'", "script-src 'unsafe-inline' 'self'"],
      ["script-src 'self'", "script-src 'self' https:"],
      ["default-src 'none'", 'default-src *'],
      ["connect-src 'self'", 'connect-src *'],
      ["base-uri 'none'; ", ''],
      ["form-action 'none'; ", ''],
      ["res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');", ''],
      ["res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');", ''],
    ].map(([before, after], i) => [`CSP/isolation ${i + 1}`, 'server/http.js', before, after, 'test/server/review.test.js']),
  ];
  const filter = process.env.MENUPILOT_MUTATION_FILTER;
  for (const [name, file, before, after, test] of mutants.filter(([name]) => !filter || name.toLowerCase().includes(filter.toLowerCase()))) {
    const path = join(dir,file), original = readFileSync(path,'utf8');
    if (!original.includes(before)) throw new Error(`Missing mutation target: ${name}`);
    const args = test.endsWith('.tsx')
      ? [join(dir, 'node_modules/vitest/vitest.mjs'), 'run', test, '-t', 'plan card labels'] : ['--test', test];
    const options = { cwd: dir, encoding: 'utf8', timeout: 30000, env: { ...process.env, VITEST_MAX_WORKERS: '2' } };
    if (test.endsWith('.tsx')) {
      const baseline = spawnSync(process.execPath, args, options);
      if (baseline.status !== 0) throw new Error(`UI mutation baseline failed: ${baseline.stdout}\n${baseline.stderr}`);
    }
    writeFileSync(path, original.replace(before,after));
    const result = spawnSync(process.execPath, args, options);
    writeFileSync(path, original);
    if (result.status === 0 || result.error || !result.stdout.toLowerCase().includes('fail')) throw new Error(`Mutation not caught: ${name}\n${result.stdout}\n${result.stderr}`);
    console.log(`CAUGHT: ${name}`);
  }
} finally { rmSync(dir,{recursive:true}); }
