import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const burgerUrl = '#/simulator/dish_classic_burger';

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
  await page.goto('./');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

async function navigate(page: Page, label: string) {
  await page.getByRole('link', { name: label, exact: true }).click();
}

test('Dashboard shows the 30-day burger increase and no change over 7 days', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Dashboard comparison details are covered at desktop width; mobile has its own responsive checks.');
  const burger = page.getByRole('row', { name: /Classic Burger/ });
  await expect(burger).toContainText('€4.20');
  await expect(burger).toContainText('€4.85');
  await expect(burger).toContainText('€0.65');
  await expect(burger).toContainText('€195.00');

  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page.getByText('No comparable dish became more expensive in this period.')).toBeVisible();
  await expect(page.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
});

test('ingredient pack prices display per-kg price and append history', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Form workflow is covered at desktop width.');
  await navigate(page, 'Ingredients');
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Test flour');
  await dialog.getByLabel('Pack size').fill('250');
  await dialog.getByLabel('Unit', { exact: true }).last().selectOption('g');
  await dialog.getByLabel('Pack price').fill('2.80');
  await expect(dialog.getByText('€11.20/kg')).toBeVisible();
  await dialog.getByRole('button', { name: 'Add ingredient' }).click();

  await page.getByRole('button', { name: 'New price for Test flour' }).click();
  const priceDialog = page.getByRole('dialog');
  await priceDialog.getByLabel('Pack price').fill('3.50');
  await priceDialog.getByRole('button', { name: 'Save price' }).click();
  await page.getByRole('button', { name: 'Price history of Test flour' }).click();
  const history = page.getByRole('dialog');
  await expect(history.getByRole('row')).toHaveCount(3);
  await expect(history).toContainText('€3.50');
  await expect(history).toContainText('€2.80');
});

test('a dish can use an ingredient and a prep, and a used prep cannot be deleted', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Recipe workflow is covered at desktop width.');
  await navigate(page, 'Recipes');
  await page.getByRole('link', { name: 'New prep' }).click();
  await page.getByLabel('Name').fill('e2e basisrecept');
  await page.getByLabel('One batch makes').fill('1');
  const prepLine = page.getByRole('group', { name: 'Line 1' });
  await prepLine.getByLabel('Ingredient or prep').selectOption({ label: 'Beef mince 80/20 · g' });
  await prepLine.getByLabel('Net quantity').fill('100');
  await prepLine.getByLabel('Yield %').fill('100');
  await page.getByRole('button', { name: 'Save prep' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  await page.getByRole('link', { name: /All recipes/ }).click();
  await page.getByRole('link', { name: 'New dish' }).click();
  await page.getByLabel('Name').fill('e2e dish');
  await page.getByLabel('Menu price').fill('12.00');
  const dishLine1 = page.getByRole('group', { name: 'Line 1' });
  await dishLine1.getByLabel('Ingredient or prep').selectOption({ label: 'Beef mince 80/20 · g' });
  await dishLine1.getByLabel('Net quantity').fill('50');
  await dishLine1.getByLabel('Yield %').fill('100');
  await page.getByRole('button', { name: 'Add line' }).click();
  const dishLine2 = page.getByRole('group', { name: 'Line 2' });
  await dishLine2.getByLabel('Ingredient or prep').selectOption({ label: 'e2e basisrecept · g' });
  await dishLine2.getByLabel('Net quantity').fill('50');
  await dishLine2.getByLabel('Yield %').fill('100');
  await expect(page.getByRole('heading', { name: 'Cost' })).toBeVisible();
  await expect(page.getByText('cost unknown')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save dish' }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  await page.getByRole('link', { name: /All recipes/ }).click();
  await page.getByRole('link', { name: 'e2e basisrecept' }).click();
  await page.getByRole('button', { name: 'Delete prep' }).click();
  const deleteDialog = page.getByRole('alertdialog');
  await deleteDialog.getByRole('button', { name: 'Delete prep' }).click();
  await expect(deleteDialog).toContainText('This prep is still used by other recipes and cannot be deleted.');
});

test('simulator saves a scenario, reloads it, and leaves real menu prices unchanged', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Simulator calculation is covered at desktop width.');
  await page.goto(burgerUrl);
  await page.getByRole('button', { name: 'Add scenario' }).click();
  const scenarioEditor = page.getByRole('region', { name: 'Scenario A', exact: true });
  await scenarioEditor.getByLabel('Menu price (incl. VAT)').fill('13.83');
  await expect(scenarioEditor).toContainText('+€0.69');
  await expect(page.getByRole('region', { name: 'Result of scenario A' })).toContainText('+€206.42');
  await page.getByRole('button', { name: 'Save scenario' }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Menu price (incl. VAT)')).toHaveValue('13.83');
  await navigate(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger' }).click();
  await expect(page.getByLabel('Menu price')).toHaveValue('13.08');
});

test('language and theme preferences persist while user recipe names remain unchanged', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Preference persistence is covered at desktop width.');
  await navigate(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger' }).click();
  await page.getByLabel('Name').fill('My house burger');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('link', { name: /All recipes/ }).click();
  await expect(page.getByRole('link', { name: 'My house burger' })).toBeVisible();

  await page.getByRole('button', { name: 'NL – Nederlands' }).click();
  await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Overzicht', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Wat is er veranderd/ })).toBeVisible();
  await expect(page.getByText('€ 4,85').first()).toBeVisible();

  await page.getByLabel('Thema').selectOption('dark');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await page.getByLabel('Thema').selectOption('light');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  await page.getByRole('link', { name: 'Recepten', exact: true }).click();
  await expect(page.getByRole('link', { name: 'My house burger' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Classic Burger' })).toHaveCount(0);
});

test('backup export, reset, valid import, and invalid import preserve data safely', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'Backup flow is covered at desktop width.');
  await navigate(page, 'Recipes');
  await page.getByRole('link', { name: 'Classic Burger' }).click();
  await page.getByLabel('Name').fill('Backup burger');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await navigate(page, 'Data');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(backupPath);
  const backup = await readFile(backupPath);
  expect(JSON.parse(backup.toString()).recipes.some((recipe: { name: string }) => recipe.name === 'Backup burger')).toBe(true);

  await page.getByRole('button', { name: 'Reset to demo data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset to demo data' }).click();
  await navigate(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Classic Burger' })).toBeVisible();
  await navigate(page, 'Data');
  await page.getByLabel('Backup file').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer: backup });
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace with backup' }).click();
  await navigate(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Backup burger' })).toBeVisible();

  await navigate(page, 'Data');
  await page.getByLabel('Backup file').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{broken') });
  const invalidImportDialog = page.getByRole('alertdialog');
  await invalidImportDialog.getByRole('button', { name: 'Replace with backup' }).click();
  await expect(page.getByRole('alert')).toContainText('imported file is not valid JSON. Your current data was not changed.');
  await invalidImportDialog.getByRole('button', { name: 'Cancel' }).click();
  await navigate(page, 'Recipes');
  await expect(page.getByRole('link', { name: 'Backup burger' })).toBeVisible();
});

test('help navigation keeps an unsaved simulator draft', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Help and simulator draft retention are covered at desktop width.');
  await page.goto(burgerUrl);
  await page.getByRole('button', { name: 'Add scenario' }).click();
  await page.getByLabel('Menu price (incl. VAT)').fill('13.83');
  await page.getByRole('link', { name: 'Help for this page' }).click();
  await expect(page).toHaveURL(/#\/help\/simulator$/);
  await page.getByRole('link', { name: 'Simulator', exact: true }).click();
  await page.getByRole('link', { name: 'Classic Burger' }).click();
  await expect(page.getByLabel('Menu price (incl. VAT)')).toHaveValue('13.83');
});

test('navigation and viewport resizing never show the error fallback or horizontal overflow', async ({ page }) => {
  for (const route of ['#/ingredients', '#/recipes', burgerUrl, '#/data', '#/']) {
    await page.goto(route);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 812 });
      await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
      const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
    }
  }
});

test('mobile navigation opens and closes and primary screens fit 375 pixels', async ({ page, isMobile }) => {
  if (!isMobile) test.skip();
  const menu = page.getByRole('button', { name: 'Menu' });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');

  for (const route of ['#/', '#/ingredients', '#/recipes', burgerUrl, '#/data']) {
    await page.goto(route);
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.width).toBe(375);
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  }
});
