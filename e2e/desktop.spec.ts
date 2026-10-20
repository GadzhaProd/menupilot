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
  await prepLine.getByLabel(/Net quantity/).fill('100');
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
  await dishLine1.getByLabel(/Net quantity/).fill('50');
  await dishLine1.getByLabel('Yield %', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Add line', exact: true }).click();
  const dishLine2 = page.getByRole('group', { name: 'Line 2', exact: true });
  await dishLine2.getByLabel('Ingredient or prep', { exact: true }).selectOption({ label: 'e2e basisrecept · g' });
  await dishLine2.getByLabel(/Net quantity/).fill('50');
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
  expect(JSON.parse(backup.toString()).recipes.some((recipe: { name: string }) => recipe.name === 'Backup burger')).toBe(true);

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
  await expect(page.getByRole('status')).toContainText('was imported');
  await page.getByRole('link', { name: 'Recipes', exact: true }).click();
  await screen(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Backup burger', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Data', exact: true }).click();
  await screen(page, 'Data');
  await page.getByLabel('Backup file', { exact: true }).setInputFiles({ name: 'invalid-schema.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1}') });
  const invalidImportDialog = page.getByRole('alertdialog');
  await invalidImportDialog.getByRole('button', { name: 'Replace with backup', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The data is not valid:');
  await expect(page.getByRole('alert')).toContainText('Your current data was not changed.');
  await invalidImportDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
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
