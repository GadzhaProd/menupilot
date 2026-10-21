import { test, expect, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';

async function freePort() {
  const probe = createServer(); await new Promise<void>(r => probe.listen(0, '127.0.0.1', r));
  const port = (probe.address() as { port: number }).port; await new Promise<void>(r => probe.close(() => r())); return port;
}
async function launch(dir: string, port: number) {
  const child = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, MENUPILOT_DATA_DIR: dir, MENUPILOT_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  if (await menu.isVisible() && await menu.getAttribute('aria-expanded') !== 'true') await menu.click();
  await page.getByRole('link', { name, exact: true }).click();
}

test('local price history survives restart; session warning preserves a draft; browser import replaces with preview', async ({ page, context }, info) => {
  const dir = await mkdtemp(join(tmpdir(), 'menupilot-e2e-')), port = await freePort();
  const origin = `http://127.0.0.1:${port}`; const external: string[] = [];
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (new URL(url).origin === origin) await route.continue();
    else { external.push(url); await route.abort(); }
  });
  let child = await launch(dir, port);
  try {
    await page.goto(`${origin}/menupilot/`);
    await expect(page.getByTestId('local-mode')).toContainText('Local mode · data:');
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
    await stop(child); child = await launch(dir, port);
    await expect(page.getByText('The local server restarted. Copy any unsaved drafts, then reload this page.')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel(/Pack price/)).toHaveValue('4.00');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Price history of Local flour', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('row')).toHaveCount(3);
    await expect(page.getByRole('dialog').getByText('€3.50', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: info.outputPath('local.png'), fullPage: true });
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
  } finally { await stop(child); await rm(dir, { recursive: true }); }
});
