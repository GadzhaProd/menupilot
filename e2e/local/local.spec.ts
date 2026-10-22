import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';

async function freePort() {
  const probe = createServer(); await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as { port: number }).port; await new Promise<void>(r => probe.close(() => r())); return port;
}
async function launch(dir: string, port: number) {
  const child = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, MENUPILOT_DATA_DIR: dir, MENUPILOT_PORT: String(port), MENUPILOT_BACKUP_DIR: join(dir, 'external-unavailable') }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise<void>((resolve, reject) => {
    let output = ''; const timer = setTimeout(() => reject(new Error('Startup timeout: ' + output)), 30000);
    child.stdout.on('data', b => { output += b; if (output.includes('MenuPilot: http')) { clearTimeout(timer); resolve(); } });
    child.stderr.on('data', b => { output += b; });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exit ${code}: ${output}`)); });
  });
  return child;
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended;
}
async function navigate(page: Page, name: string) {
  await expect(page.getByTestId('local-mode')).toBeVisible();
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}

test('local price history survives restart; session warning preserves a draft; browser import replaces with preview', async ({ page, context }, info) => {
  const dir = await mkdtemp(join(tmpdir(), 'menupilot-e2e-')), port = await freePort();
  const origin = `http://127.0.0.1:${port}`; const external: string[] = [];
  const cspErrors: string[] = [];
  page.on('console', message => { if (/Content Security Policy|script-src/.test(message.text())) cspErrors.push(message.text()); });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (new URL(url).origin === origin) await route.continue();
    else { external.push(url); await route.abort(); }
  });
  let child = await launch(dir, port);
  try {
    await page.goto(`${origin}/menupilot/`);
    await expect(page.getByText('Open MenuPilot from your terminal', { exact: true })).toBeVisible();
    await page.goto(`${origin}/menupilot/#k=${await readFile(join(dir, 'launch-secret'), 'utf8')}`);
    await expect(page.getByTestId('local-mode')).toContainText('Local mode · data:');
    expect(page.url()).not.toContain('k=');
    await expect(page.getByTestId('backup-status')).toContainText('Last backup: none yet');
    await expect(page.getByTestId('backup-status')).toContainText('External copy failed');
    await expect(page.getByTestId('backup-status')).toContainText('does not prove it has synced');
    const token = await page.evaluate(() => sessionStorage.getItem('menupilot.local.token.v1'));
    const config = { token: token! };
    expect((await page.request.get(`${origin}/menupilot/local-config.json`)).status()).toBe(401);
    const secondContext = await page.context().browser()!.newContext({ storageState: await context.storageState() });
    await secondContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const other = await secondContext.newPage();
    await other.goto(`${origin}/menupilot/`);
    await expect(other.getByRole('alert')).toContainText('open-url');
    await other.goto(`${origin}/menupilot/#k=${await readFile(join(dir, 'launch-secret'), 'utf8')}`);
    await expect(other.getByTestId('local-mode')).toBeVisible();
    // Two independent browser contexts share one session but still compete by CAS.
    const current = await (await page.request.get(`${origin}/api/document`, { headers: { Authorization: `Bearer ${config.token}` } })).json();
    const race = await Promise.all([page, other].map((p, i) => p.evaluate(async ({ origin, token, current, i }) => {
      const r = await fetch(origin + '/api/write', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'save', expectedDocumentId: current.documentId, expectedRevision: current.revision, opId: 'browser-' + i, document: { ...current.document, settings: { defaultVatRateBp: 900 + i } } }) });
      return r.json();
    }, { origin, token: config.token, current, i })));
    expect(race.filter(r => r.conflict)).toHaveLength(1);
    expect(race.filter(r => r.receipt?.changed)).toHaveLength(1);
    await secondContext.close();
    await page.reload();
    await navigate(page, 'Ingredients');
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name', { exact: true }).fill('Local flour');
    await dialog.getByLabel(/Pack size/).fill('250');
    await dialog.getByLabel('Unit', { exact: true }).selectOption('g');
    await dialog.getByLabel(/Pack price/).fill('2.80');
    await dialog.getByRole('button', { name: 'Add ingredient', exact: true }).click();
    await page.getByRole('button', { name: 'New price for Local flour', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Pack price/).fill('3.50');
    await dialog.getByRole('button', { name: 'Save price', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // An unfinished editor must survive polling a restarted server.
    await page.getByRole('button', { name: 'New price for Local flour', exact: true }).click();
    await page.getByRole('dialog').getByLabel(/Pack price/).fill('4.00');
    await stop(child);
    // Persist a detected clock jump and a damaged snapshot while the writer is stopped.
    const db = new DatabaseSync(join(dir, 'menupilot.db'));
    db.prepare("INSERT INTO meta(key,value) VALUES('backupClockWarning','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
    db.close();
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(dir, 'backups', `${Date.now()}-${crypto.randomUUID()}.sqlite`), 'damaged snapshot');
    child = await launch(dir, port);
    await expect(page.getByText('The local server restarted. Copy any unsaved drafts, then reload this page.')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel(/Pack price/)).toHaveValue('4.00');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto(`${origin}/menupilot/#k=${await readFile(join(dir, 'launch-secret'), 'utf8')}`);
    await navigate(page, 'Ingredients');
    await page.getByRole('button', { name: 'Price history of Local flour', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('row')).toHaveCount(3);
    await expect(page.getByRole('dialog').getByText('€3.50', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('backup-status')).toContainText('Last backup:');
    await expect(page.getByTestId('backup-status')).not.toContainText('Last backup: none yet');
    await expect(page.getByTestId('backup-status')).toContainText('Automatic backup deletion is paused');
    await expect(page.getByTestId('backup-status')).toContainText('Damaged backups');
    await page.screenshot({ path: info.outputPath('local.png'), fullPage: true });
    await page.getByRole('button', { name: 'NL – Nederlands' }).click();
    await expect(page.getByTestId('backup-status')).toContainText('Laatste reservekopie:');
    await expect(page.getByTestId('backup-status')).toContainText('Externe kopie mislukt');
    await expect(page.getByTestId('backup-status')).toContainText('bewijst niet');
    await expect(page.getByTestId('backup-status')).toContainText('Automatisch verwijderen');
    await expect(page.getByTestId('backup-status')).toContainText('Beschadigde reservekopieën');
    await page.screenshot({ path: info.outputPath('local-backups-nl.png'), fullPage: true });
    await page.getByRole('button', { name: 'EN – English' }).click();
    await navigate(page, 'Data');
    const imported = { version: 1, settings: { defaultVatRateBp: 900 }, ingredients: [{ id: 'imported', name: 'Browser export', unit: 'g', prices: [] }], recipes: [], scenarios: [] };
    await page.locator('input[type="file"]').setInputFiles({ name: 'browser-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toContainText('browser-backup.json');
    await expect(page.getByRole('alertdialog')).toContainText('without merging');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace with backup', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await navigate(page, 'Ingredients');
    await expect(page.getByText('Browser export', { exact: true })).toBeVisible();
    await expect(page.getByText('Local flour', { exact: true })).toHaveCount(0);
    expect(external).toEqual([]);
    expect(cspErrors).toEqual([]);
  } finally { await stop(child); await rm(dir, { recursive: true }); }
});

test('agent proposes; owner confirms or rejects; Dashboard refreshes and dialog keeps keyboard focus', async ({ page, context }, info) => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const exec = promisify(execFile);
  const dir = await mkdtemp(join(tmpdir(), 'menupilot-plan-e2e-')), port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env, MENUPILOT_DATA_DIR: dir };
  const cli = async (args: string[]) => JSON.parse((await exec(process.execPath, ['server/cli.js', ...args, '--json'], { env })).stdout);
  await exec(process.execPath, ['--input-type=module', '-e', `
    import { readFileSync } from 'node:fs';
    import { createSqliteStorage } from './server/sqlite.js';
    const s = createSqliteStorage(process.env.MENUPILOT_DATA_DIR + '/menupilot.db', { initialDocument: JSON.parse(readFileSync('data/demo.json', 'utf8')) });
    s.write({ kind: 'save', document: s.load().document, expectedDocumentId: null, expectedRevision: 0, opId: 'fixture' }); s.close();
  `], { env });
  const external: string[] = [];
  await context.route('**/*', async route => {
    if (new URL(route.request().url()).origin === origin) await route.continue();
    else { external.push(route.request().url()); await route.abort(); }
  });
  const child = await launch(dir, port);
  try {
    await page.goto(`${origin}/menupilot/#k=${await readFile(join(dir, 'launch-secret'), 'utf8')}`);
    await expect(page.getByTestId('local-mode')).toBeVisible();
    const before = await cli(['dish', 'dish_classic_burger']);
    const proposal = await cli(['propose', 'add-price', '--ingredient', 'ing_beef', '--pack-price', '18,00', '--pack-size', '1', 'kg']);
    const panel = page.getByTestId('plans-panel');
    await expect(panel.getByRole('heading', { name: 'Awaiting your confirmation' })).toBeVisible();
    await expect(panel).toContainText('€18.00/kg');
    await page.screenshot({ path: info.outputPath('plans-en.png'), fullPage: true });
    await panel.getByRole('button', { name: 'Apply', exact: true }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await dialog.getByRole('button', { name: 'Confirm apply', exact: true }).click();
    await expect(panel).toContainText('Price applied.');
    const after = await cli(['dish', 'dish_classic_burger']);
    expect(after.data).not.toEqual(before.data);
    expect((await cli(['plan', 'status', proposal.data.id])).data.status).toBe('applied');
    // Polling updates the existing Dashboard; its displayed cost matches shared calc output.
    const effects = proposal.data.effects.dishes.find((d: { id: string }) => d.id === 'dish_classic_burger');
    const { formatEURFromMicroLocale } = await import('../../src/calc/money.js');
    const cost = formatEURFromMicroLocale(BigInt(effects.currentCostMicro), 'en');
    await expect(page.locator('main').getByText(cost, { exact: true }).first()).toBeVisible();
    const rejected = await cli(['propose', 'add-price', '--ingredient', 'ing_beef', '--pack-price', '19', '--pack-size', '1 kg']);
    await expect(panel.getByRole('button', { name: 'Reject', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Reject', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
    await expect(panel).toContainText('Proposal rejected.');
    expect((await cli(['plan', 'status', rejected.data.id])).data.status).toBe('rejected');
    expect((await cli(['dish', 'dish_classic_burger'])).data).toEqual(after.data);
    await page.goto(origin + '/menupilot/#/recipe/dish_classic_burger');
    await page.getByLabel('Name', { exact: true }).fill('Owner unsaved recipe');
    await cli(['propose', 'add-price', '--ingredient', 'ing_beef', '--pack-price', '20', '--pack-size', '1 kg']);
    await panel.getByRole('button', { name: 'Apply', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirm apply', exact: true }).click();
    await expect(panel).toContainText('Price applied.');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Owner unsaved recipe');
    await expect(page.getByText(/Another tab changed|saved data changed|Data changed/i).first()).toBeVisible();
    expect(external).toEqual([]);
  } finally { await stop(child); await rm(dir, { recursive: true }); }
});
