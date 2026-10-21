import { expect, test } from './fixtures';

const burgerUrl = '#/simulator/dish_classic_burger';
const screen = (page: import('@playwright/test').Page, name: string | RegExp) =>
  expect(page.getByRole('heading', { name, exact: typeof name === 'string' })).toBeVisible();
const noOverflow = async (page: import('@playwright/test').Page) => {
  const dimensions = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.width).toBe(375);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
};

test('mobile menu closes with Escape and a second press', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await menu.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});

test('ingredient add dialog and form fit 375 pixels', async ({ page }) => {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('link', { name: 'Ingredients', exact: true }).click();
  await screen(page, 'Ingredients');
  await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Name', { exact: true }).fill('Mobile flour');
  await dialog.getByLabel(/Pack size/).fill('250');
  await dialog.getByLabel('Unit', { exact: true }).selectOption('g');
  await dialog.getByLabel(/Pack price/).fill('2.80');
  await expect(dialog.getByRole('button', { name: 'Add ingredient', exact: true })).toBeEnabled();
  await noOverflow(page);
});

test('mobile recipe editor has no overflow and keeps save available', async ({ page }) => {
  await page.goto('#/recipe/new?kind=dish');
  await screen(page, 'New dish');
  await page.getByLabel('Name', { exact: true }).fill('Mobile recipe draft');
  const save = page.getByRole('button', { name: 'Save dish', exact: true });
  await expect(save).toBeEnabled();
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeVisible();
  await noOverflow(page);
});

test('mobile simulator scenario is editable and fits the screen', async ({ page }) => {
  await page.goto(burgerUrl);
  await screen(page, 'Simulator: Classic Burger');
  await page.getByRole('button', { name: 'Add scenario', exact: true }).click();
  const scenario = page.getByRole('region', { name: 'Scenario A', exact: true });
  await scenario.getByLabel('Menu price (incl. VAT)', { exact: true }).fill('13.83');
  await expect(scenario.getByLabel('Scenario name', { exact: true })).toHaveValue('Scenario A');
  await expect(page.getByRole('button', { name: 'Save scenario', exact: true })).toBeEnabled();
  await noOverflow(page);
});

test('primary mobile screens transition without error or horizontal scrolling', async ({ page }) => {
  for (const [route, heading] of [['#/', 'What has changed on your menu?'], ['#/ingredients', 'Ingredients'], ['#/recipes', 'Recipes'], [burgerUrl, 'Simulator: Classic Burger'], ['#/data', 'Data']] as const) {
    await page.goto(route);
    await screen(page, heading);
    await expect(page.getByText('Something went wrong', { exact: true })).toHaveCount(0);
    await noOverflow(page);
  }
});

test('Dutch mobile saving state preserves the new ingredient draft at 375px', async ({ page }) => {
  const { holdWriter } = await import('./fixtures');
  await page.getByRole('button', { name: 'NL – Nederlands' }).click();
  await page.goto('#/ingredients');
  await page.getByRole('button', { name: 'Ingrediënt toevoegen', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Naam', { exact: true }).fill('Zout');
  const release = await holdWriter(page);
  await dialog.getByRole('button', { name: 'Ingrediënt toevoegen', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Opslaan…', exact: true })).toBeDisabled();
  await expect(dialog.getByLabel('Naam', { exact: true })).toHaveValue('Zout');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  await release();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: /^Opgeslagen$/ })).toBeVisible();
});
