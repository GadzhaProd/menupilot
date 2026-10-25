import { readFile } from 'node:fs/promises';
import { expect, test } from './fixtures';

const burgerUrl = '#/simulator/dish_classic_burger';
const screen = (page: import('@playwright/test').Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name, exact: typeof name === 'string' })).toBeVisible();
const menuPrice = (page: import('@playwright/test').Page) => page.getByLabel('Menu price (incl. VAT)', { exact: true });

test('Dashboard shows exact 30-day burger impact and no change over 7 days', async ({ page }) => {
  await screen(page, 'What has changed on your menu?');
  const burger = page.getByRole('row', { name: /Classic Burger/ });
  const cells = burger.getByRole('cell');
  await expect(cells.nth(1)).toHaveText('€4.20');
  await expect(cells.nth(2)).toHaveText('€4.85');
  await expect(cells.nth(3)).toContainText('€0.65');
  await expect(cells.nth(5)).toHaveText('-€195.00');
  await expect(page.getByRole('button', { name: '30 days', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '7 days', exact: true }).click();
  await expect(page.getByText('No comparable dish became more expensive in this period.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '7 days', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('ingredient pack prices display per-kg price and append history', async ({ page }) => {
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await screen(page, 'Ingredients');
  await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name', { exact: true }).fill('Test flour');
  await dialog.getByLabel(/Pack size/).fill('250');
  await dialog.getByLabel('Unit', { exact: true }).selectOption('g');
  await dialog.getByLabel(/Pack price/).fill('2.80');
  await expect(dialog.getByText(/€11.20\/kg/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Add ingredient', exact: true }).click();
  await expect(page.getByRole('row', { name: /Test flour/ })).toBeVisible();

  await page.getByRole('button', { name: 'New price for Test flour', exact: true }).click();
  const priceDialog = page.getByRole('dialog');
  await priceDialog.getByLabel(/Pack price/).fill('3.50');
  await priceDialog.getByRole('button', { name: 'Save price', exact: true }).click();
  await page.getByRole('button', { name: 'Price history of Test flour', exact: true }).click();
  const history = page.getByRole('dialog');
  await expect(history.getByRole('row')).toHaveCount(3);
  await expect(history.getByText('€3.50', { exact: true })).toBeVisible();
  await expect(history.getByText('€2.80', { exact: true })).toBeVisible();
});

test('a dish uses an ingredient and prep at exact costs, and used prep deletion is refused', async ({ page }) => {
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'New prep', exact: true }).click();
  await screen(page, 'New prep');
  await page.getByLabel('Name', { exact: true }).fill('e2e basisrecept');
  await page.getByLabel(/One batch makes/).fill('1');
  await page.getByLabel('Batch unit', { exact: true }).selectOption('kg');
  const prepLine = page.getByRole('group', { name: 'Line 1', exact: true });
  await prepLine.getByLabel('Ingredient or prep', { exact: true }).selectOption({ label: 'Beef mince 80/20 · g' });
  await prepLine.getByLabel(/Net quantity/).fill('0.1');
  await prepLine.getByLabel('Yield %', { exact: true }).fill('100');
  const prepCost = page.getByRole('region', { name: 'Cost', exact: true });
  const prepValues = prepCost.getByRole('definition');
  await expect(prepValues.nth(0)).toHaveText('€1.70');
  await expect(prepValues.nth(2)).toHaveText('€1.70/kg');
  await page.getByRole('button', { name: 'Save prep', exact: true }).click();
  await screen(page, 'e2e basisrecept');
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();

  await page.getByRole('link', { name: /All recipes/ }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'New dish', exact: true }).click();
  await screen(page, 'New dish');
  await page.getByLabel('Name', { exact: true }).fill('e2e dish');
  await page.getByLabel('Menu price (incl. VAT)', { exact: true }).fill('12.00');
  const dishLine1 = page.getByRole('group', { name: 'Line 1', exact: true });
  await dishLine1.getByLabel('Ingredient or prep', { exact: true }).selectOption({ label: 'Beef mince 80/20 · g' });
  await dishLine1.getByLabel(/Net quantity/).fill('0.05');
  await dishLine1.getByLabel('Yield %', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Add line', exact: true }).click();
  const dishLine2 = page.getByRole('group', { name: 'Line 2', exact: true });
  await dishLine2.getByLabel('Ingredient or prep', { exact: true }).selectOption({ label: 'e2e basisrecept · g' });
  await dishLine2.getByLabel(/Net quantity/).fill('0.05');
  await dishLine2.getByLabel('Yield %', { exact: true }).fill('100');
  const dishCost = page.getByRole('region', { name: 'Cost', exact: true });
  await expect(dishCost.getByRole('definition').nth(1)).toHaveText('€0.94');
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await screen(page, 'e2e dish');
  await expect(page.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();

  await page.getByRole('link', { name: /All recipes/ }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'e2e basisrecept', exact: true }).click();
  await screen(page, 'e2e basisrecept');
  await page.getByRole('button', { name: 'Delete prep', exact: true }).click();
  const deleteDialog = page.getByRole('alertdialog');
  await deleteDialog.getByRole('button', { name: 'Delete prep', exact: true }).click();
  await expect(deleteDialog.getByRole('alert')).toContainText('This prep is still used by other recipes and cannot be deleted.');
  await deleteDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await screen(page, 'e2e basisrecept');
  await page.getByRole('link', { name: /All recipes/ }).click();
  await screen(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'e2e basisrecept', exact: true })).toBeVisible();
});

test('simulator saves Scenario A and leaves real ingredient prices and recipe cost unchanged', async ({ page }) => {
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger', exact: true }).click();
  await screen(page, 'Classic Burger');
  const realMenuPrice = await menuPrice(page).inputValue();
  const recipeCost = page.getByRole('region', { name: 'Cost', exact: true });
  const realRecipeCost = (await recipeCost.innerText()).replace(/\s+/g, ' ').trim();
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await screen(page, 'Ingredients');
  const ingredientRows = page.getByRole('row');
  const realIngredientPrices = (await ingredientRows.allInnerTexts()).map(text => text.replace(/\s+/g, ' ').trim());

  await page.goto(burgerUrl);
  await screen(page, 'Simulator: Classic Burger');
  await page.getByRole('button', { name: 'Add scenario', exact: true }).click();
  const scenarioEditor = page.getByRole('region', { name: 'Scenario A', exact: true });
  await menuPrice(scenarioEditor).fill('13.83');
  const contributionRow = page.getByRole('row', { name: /Contribution per portion/ });
  const monthlyRow = page.getByRole('row', { name: /Estimated monthly contribution/ });
  await expect(contributionRow.getByRole('cell').nth(1)).toContainText('€7.84');
  await expect(contributionRow.getByRole('cell').nth(1)).toContainText('+€0.69');
  await expect(monthlyRow.getByRole('cell').nth(1)).toContainText('+€206.42');
  await page.getByRole('button', { name: 'Save scenario', exact: true }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await page.reload();
  await screen(page, 'Simulator: Classic Burger');
  await expect(page.getByRole('region', { name: 'Scenario A', exact: true })).toBeVisible();
  await expect(page.getByLabel('Scenario name', { exact: true })).toHaveValue('Scenario A');
  await expect(menuPrice(page)).toHaveValue('13.83');

  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger', exact: true }).click();
  await screen(page, 'Classic Burger');
  await expect(menuPrice(page)).toHaveValue(realMenuPrice);
  expect((await page.getByRole('region', { name: 'Cost', exact: true }).innerText()).replace(/\s+/g, ' ').trim()).toBe(realRecipeCost);
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await screen(page, 'Ingredients');
  expect((await page.getByRole('row').allInnerTexts()).map(text => text.replace(/\s+/g, ' ').trim())).toEqual(realIngredientPrices);
});

test('language and theme persist while user recipe names remain unchanged', async ({ page }) => {
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger', exact: true }).click();
  await screen(page, 'Classic Burger');
  await page.getByLabel('Name', { exact: true }).fill('My house burger');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('link', { name: /All recipes/ }).click();
  await screen(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'My house burger', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'NL – Nederlands', exact: true }).click();
  await screen(page, 'Recepten');
  await page.getByRole('link', { name: 'Overzicht', exact: true }).click();
  await screen(page, /Wat is er veranderd/);
  const burger = page.getByRole('row', { name: /My house burger/ });
  await expect(burger.getByRole('cell').nth(2)).toHaveText('€ 4,85');
  await page.reload();
  await screen(page, /Wat is er veranderd/);
  await expect(page.getByRole('button', { name: 'NL – Nederlands', exact: true })).toBeVisible();
  await expect(page.getByRole('row', { name: /My house burger/ }).getByRole('cell').nth(2)).toHaveText('€ 4,85');

  await page.getByLabel('Thema', { exact: true }).selectOption('dark');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.reload();
  await screen(page, /Wat is er veranderd/);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.getByLabel('Thema', { exact: true }).selectOption('light');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.reload();
  await screen(page, /Wat is er veranderd/);
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('link', { name: 'Recepten', exact: true }).click();
  await screen(page, 'Recepten');
  await expect(page.getByRole('link', { name: 'My house burger', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Classic Burger', exact: true })).toHaveCount(0);
});

test('backup export, demo reset, valid import and invalid files preserve data safely', async ({ page }, testInfo) => {
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger', exact: true }).click();
  await screen(page, 'Classic Burger');
  await page.getByLabel('Name', { exact: true }).fill('Backup burger');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('link', { name: 'Data', exact: true }).click();
  await screen(page, 'Data');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(backupPath);
  const backup = await readFile(backupPath);
  expect(JSON.parse(backup.toString()).document.recipes.some((recipe: { name: string }) => recipe.name === 'Backup burger')).toBe(true);

  await page.getByRole('button', { name: 'Reset to demo data', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset to demo data', exact: true }).click();
  await expect(page.getByText('Demo data restored.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Classic Burger', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Data', exact: true }).click();
  await screen(page, 'Data');
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: backup });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace with backup', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'was imported' })).toBeVisible();
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Backup burger', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Data', exact: true }).click();
  await screen(page, 'Data');
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: 'invalid-schema.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') });
  await expect(page.getByRole('alert')).toContainText('This file does not match the MenuPilot format.');
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Backup burger', exact: true })).toBeVisible();
});

test('help navigation keeps an unsaved simulator draft', async ({ page }) => {
  await page.goto(burgerUrl);
  await screen(page, 'Simulator: Classic Burger');
  await page.getByRole('button', { name: 'Add scenario', exact: true }).click();
  await menuPrice(page).fill('13.83');
  await page.getByRole('link', { name: 'Help for this page', exact: true }).click();
  await screen(page, 'MenuPilot: step-by-step guide');
  await expect(page).toHaveURL(/#\/help\/simulator$/);
  await page.getByRole('link', { name: 'Simulator', exact: true }).click();
  await screen(page, 'Simulator');
  await page.getByRole('link', { name: /Classic Burger/ }).click();
  await screen(page, 'Simulator: Classic Burger');
  await expect(menuPrice(page)).toHaveValue('13.83');
});

test('navigation and viewport resizing preserve recipe and simulator drafts without overflow', async ({ page }) => {
  await page.goto('#/recipe/new?kind=dish');
  await screen(page, 'New dish');
  await page.getByLabel('Name', { exact: true }).fill('Viewport draft dish');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 800 });
    await screen(page, 'New dish');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Viewport draft dish');
    await expect(page.getByRole('button', { name: 'Save dish', exact: true })).toBeEnabled();
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  }

  await page.goto(burgerUrl);
  await screen(page, 'Simulator: Classic Burger');
  await page.getByRole('button', { name: 'Add scenario', exact: true }).click();
  await menuPrice(page).fill('13.83');
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 800 });
    await screen(page, 'Simulator: Classic Burger');
    await expect(menuPrice(page)).toHaveValue('13.83');
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  }

  for (const [route, heading] of [['#/ingredients', 'Ingredients'], ['#/recipes', 'Recipes'], ['#/data', 'Data'], ['#/', 'What has changed on your menu?']] as const) {
    await page.goto(route);
    await screen(page, heading);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  }
});

test('automatic network guard blocks an intentional external request', async ({ page, blockedExternalUrls }) => {
  const rejected = await page.evaluate(async () => {
    try {
      await fetch('https://network-guard.invalid/probe');
      return false;
    } catch {
      return true;
    }
  });
  expect(rejected).toBe(true);
  expect(blockedExternalUrls).toEqual(['https://network-guard.invalid/probe']);
  // This is the one deliberately attempted request; acknowledge it after proving
  // that the context route caught and aborted it. All other requests must remain absent.
  blockedExternalUrls.splice(0, 1);
});

test('two tabs preserve a price history through a stale rename conflict and retry', async ({ page }) => {
  const context = page.context();
  const second = await context.newPage();
  await second.clock.install({ time: new Date('2026-10-20T12:00:00.000Z') });
  await second.goto('./');
  await expect(second.getByRole('heading', { name: 'What has changed on your menu?' })).toBeVisible();
  await second.getByRole('link', { name: 'Ingredients', exact: true }).click();
  const minceRow = second.getByRole('row', { name: /Beef mince 80\/20/ });
  await minceRow.getByRole('button', { name: 'Rename Beef mince 80/20', exact: true }).click();
  const rename = second.getByRole('dialog');
  await rename.getByLabel('Name', { exact: true }).fill('House mince');

  await page.bringToFront();
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  const activeMince = page.getByRole('row', { name: /Beef mince 80\/20/ });
  await activeMince.getByRole('button', { name: 'New price for Beef mince 80/20', exact: true }).click();
  const price = page.getByRole('dialog');
  await price.getByLabel(/Pack price/).fill('18.00');
  await price.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(page.getByRole('row', { name: /Beef mince 80\/20/ }).getByRole('cell').nth(3)).toHaveText('€18.00');

  await second.bringToFront();
  await rename.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(rename.getByRole('status')).toContainText('Another tab changed the saved data');
  await expect(rename.getByLabel('Name', { exact: true })).toHaveValue('House mince');
  await rename.getByRole('button', { name: 'Load latest data', exact: true }).click();
  await expect(rename).toBeVisible();
  await expect(rename.getByLabel('Name', { exact: true })).toHaveValue('House mince');
  await rename.getByRole('button', { name: 'Rename', exact: true }).click();
  await expect(rename).toHaveCount(0);

  const saved = await second.evaluate(() => JSON.parse(localStorage.getItem('menupilot:v1')!).document);
  const mince = saved.ingredients.find((ingredient: { name: string }) => ingredient.name === 'House mince');
  expect(mince).toBeTruthy();
  expect(mince.prices.map((entry: { packPriceCents: number }) => entry.packPriceCents)).toEqual([1400, 1700, 1800]);
});

test('a recipe draft survives a concurrent update and shows the save conflict', async ({ page }) => {
  await page.goto('#/recipe/new?kind=dish');
  await screen(page, 'New dish');
  await page.getByLabel('Name', { exact: true }).fill('Saved after conflict');
  await page.getByLabel('Menu price (incl. VAT)', { exact: true }).fill('12.00');
  const line = page.getByRole('group', { name: 'Line 1', exact: true });
  await line.getByLabel('Ingredient or prep', { exact: true }).selectOption({ label: 'Beef mince 80/20 · g' });
  await line.getByLabel(/Net quantity/).fill('0.1');
  await line.getByLabel('Yield %', { exact: true }).fill('100');
  await page.getByRole('link', { name: 'Help for this page', exact: true }).click();
  await screen(page, 'MenuPilot: step-by-step guide');
  await expect(page).toHaveURL(/#\/help\/dishes$/);
  const savedDraftNotice = page.getByRole('status').filter({ hasText: 'Unsaved draft: Saved after conflict' });
  await expect(savedDraftNotice).toBeVisible();

  const second = await page.context().newPage();
  await second.clock.install({ time: new Date('2026-10-20T12:00:00.000Z') });
  await second.goto('./');
  await second.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await second.getByRole('row', { name: /Beef mince 80\/20/ }).getByRole('button', { name: 'New price for Beef mince 80/20', exact: true }).click();
  const priceDialog = second.getByRole('dialog');
  await priceDialog.getByLabel(/Pack price/).fill('18.00');
  await priceDialog.getByRole('button', { name: 'Save price', exact: true }).click();

  await page.bringToFront();
  const conflictNotice = page.getByRole('status').filter({ hasText: 'Another tab changed the saved data' });
  await expect(savedDraftNotice).toBeVisible();
  // Navigate inside the app so its in-memory recipe draft cache remains alive.
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await page.getByRole('link', { name: 'New dish', exact: true }).click();
  await screen(page, 'New dish');
  await expect(savedDraftNotice).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Saved after conflict');
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await expect(conflictNotice).toBeVisible();
  await page.getByRole('button', { name: 'Load latest data', exact: true }).click();
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Saved after conflict');
  await page.getByRole('button', { name: 'Save dish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved after conflict', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('menupilot:v1')!).document);
  expect(saved.ingredients.find((ingredient: { name: string }) => ingredient.name === 'Beef mince 80/20').prices.at(-1).packPriceCents).toBe(1800);
  expect(saved.recipes.some((recipe: { name: string }) => recipe.name === 'Saved after conflict')).toBe(true);
});

test('idle tab refreshes itself', async ({ page }) => {
  const second = await page.context().newPage();
  await second.clock.install({ time: new Date('2026-10-20T12:00:00.000Z') });
  await second.goto('./');
  await second.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await expect(second.getByRole('row', { name: /Beef mince 80\/20/ })).toBeVisible();

  await page.bringToFront();
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await page.getByRole('row', { name: /Beef mince 80\/20/ }).getByRole('button', { name: 'New price for Beef mince 80/20', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Pack price/).fill('18.00');
  await dialog.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(second.getByRole('row', { name: /Beef mince 80\/20/ }).getByRole('cell').nth(3)).toHaveText('€18.00');
});

test('storage cleared in another tab keeps the displayed document and shows a warning', async ({ page }) => {
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await page.getByRole('row', { name: /Beef mince 80\/20/ }).getByRole('button', { name: 'New price for Beef mince 80/20', exact: true }).click();
  const price = page.getByRole('dialog');
  await price.getByLabel(/Pack price/).fill('18.00');
  await price.getByRole('button', { name: 'Save price', exact: true }).click();
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  const second = await page.context().newPage();
  await second.clock.install({ time: new Date('2026-10-20T12:00:00.000Z') });
  await second.goto('./');
  await second.evaluate(() => localStorage.removeItem('menupilot:v1'));
  await expect(page.getByRole('status')).toContainText('The saved data was removed in another tab');
  await expect(page.getByRole('heading', { name: 'What has changed on your menu?' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Classic Burger/ })).toBeVisible();
});

async function exerciseRecovery(page: import('@playwright/test').Page, testInfo: import('@playwright/test').TestInfo, dutch: boolean) {
  if (dutch) await page.getByRole('button', { name: 'NL – Nederlands', exact: true }).click();
  await page.getByRole('link', { name: dutch ? 'Gegevens' : 'Data', exact: true }).click();
  const backupDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: dutch ? 'Reservekopie exporteren' : 'Export backup', exact: true }).click();
  const backupDownload = await backupDownloadPromise;
  const backupPath = testInfo.outputPath(`valid-${backupDownload.suggestedFilename()}`);
  await backupDownload.saveAs(backupPath);
  const original = await readFile(backupPath, 'utf8');
  const backupDocument = JSON.parse(original);
  backupDocument.recipes.find((recipe: { name: string }) => recipe.name === 'Classic Burger').name = 'Restored Burger';
  const validBackup = Buffer.from(JSON.stringify(backupDocument, null, 2));
  const damaged = '{"version":1,\n\u0000 damaged bytes';
  await page.evaluate((raw) => localStorage.setItem('menupilot:v1', raw), damaged);
  await page.reload();

  const downloadLabel = dutch ? 'Beschadigde gegevens downloaden' : 'Download damaged data';
  const restoreLabel = dutch ? 'Herstellen vanuit een reservekopie' : 'Restore from backup';
  await expect(page.getByRole('heading', { name: dutch ? 'Je gegevens konden niet worden geopend' : 'Your data could not be opened' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: downloadLabel, exact: true }).click();
  const download = await downloadPromise;
  const savedPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(savedPath);
  expect(await readFile(savedPath)).toEqual(Buffer.from(damaged));

  const backupLabel = dutch ? 'Reservekopiebestand' : 'Backup file';
  await page.getByLabel(backupLabel, { exact: true }).setInputFiles({
    name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}'),
  });
  await expect(page.getByRole('alert').filter({ hasText: dutch
    ? 'Deze reservekopie is ongeldig of gebruikt een niet-ondersteund formaat.'
    : 'This backup is not valid or uses an unsupported format.' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('menupilot:v1'))).toBe(damaged);

  await page.getByRole('button', { name: restoreLabel, exact: true }).click();
  await page.getByLabel(backupLabel, { exact: true }).setInputFiles({
    name: 'valid-backup.json', mimeType: 'application/json', buffer: validBackup,
  });
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole('button', { name: dutch ? 'Vervangen door reservekopie' : 'Replace with backup', exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await page.reload();
  await page.getByRole('link', { name: dutch ? 'Recepten' : 'Recipes', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Restored Burger', exact: true })).toBeVisible();
}

test('recovery downloads exact damaged bytes and restores a validated copy in English', async ({ page }, testInfo) => {
  await exerciseRecovery(page, testInfo, false);
});

test('recovery downloads exact damaged bytes and restores a validated copy in Dutch', async ({ page }, testInfo) => {
  await exerciseRecovery(page, testInfo, true);
});


test('version history restores previous data as a new revision and archives the replaced data', async ({ page }) => {
  await page.goto('#/recipe/dish_classic_burger');
  await page.getByLabel('Name', { exact: true }).fill('First saved burger');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'First saved burger', exact: true })).toBeVisible();
  await page.getByLabel('Name', { exact: true }).fill('Second saved burger');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Second saved burger', exact: true })).toBeVisible();
  const revision = await page.evaluate(() => localStorage.getItem('menupilot:revision'));
  await page.getByRole('link', { name: 'Data', exact: true }).click();
  await page.getByRole('button', { name: 'Preview version', exact: true }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Changed: Second saved burger (recipe)');
  await dialog.getByRole('button', { name: 'Restore this version', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Preview version', exact: true })).toHaveCount(2);
  expect(await page.evaluate(() => localStorage.getItem('menupilot:revision'))).not.toBe(revision);
  await page.goto('#/recipe/dish_classic_burger');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('First saved burger');
  const versions = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('menupilot:history:')).map(k => JSON.parse(localStorage.getItem(k)!).raw));
  expect(versions.some(raw => raw.includes('Second saved burger'))).toBe(true);
});

test('queued price save keeps the dialog and commits once after the writer is released', async ({ page }) => {
  const { holdWriter } = await import('./fixtures');
  await page.goto('#/ingredients');
  await page.getByRole('button', { name: 'New price for Beef mince 80/20', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Pack price/).fill('18.75');
  const release = await holdWriter(page);
  await dialog.getByRole('button', { name: 'Save price', exact: true }).click();
  const saving = dialog.getByRole('button', { name: 'Saving…', exact: true });
  await expect(saving).toBeDisabled();
  await expect(dialog.getByLabel(/Pack price/)).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await saving.dispatchEvent('click');
  expect(await page.evaluate(() => localStorage.getItem('menupilot:v1'))).toBeNull();
  await release();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  const envelope = await page.evaluate(() => JSON.parse(localStorage.getItem('menupilot:v1')!));
  expect(envelope.revision).toBe(1);
  expect(envelope.document.ingredients[0].prices).toHaveLength(3);
  expect(envelope.document.ingredients[0].prices.at(-1).packPriceCents).toBe(1875);
});
