import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const languages = [
  { key: 'en', button: 'EN – English', add: 'Add ingredient', reset: 'Reset to demo data' },
  { key: 'nl', button: 'NL – Nederlands', add: 'Ingrediënt toevoegen', reset: 'Terugzetten naar voorbeeldgegevens' },
] as const;

async function expectNoSeriousAxeViolations(page: import('@playwright/test').Page, context: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const violations = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  expect(violations, `${context}: ${violations.map(v => `${v.id} (${v.impact}): ${v.nodes.map(n => n.target.join(' ')).join(', ')}`).join('\n')}`)
    .toEqual([]);
}

for (const language of languages) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe has no serious or critical violations: ${language.key}, ${theme}`, async ({ page }) => {
      await page.getByRole('button', { name: language.button, exact: true }).click();
      await page.getByLabel(language.key === 'en' ? 'Theme' : 'Thema', { exact: true }).selectOption(theme);

      const pages = [
        ['#/', language.key === 'en' ? 'What has changed on your menu?' : 'Wat is er veranderd aan je menu?'],
        ['#/simulator/dish_classic_burger', language.key === 'en' ? 'Simulator: Classic Burger' : 'Simulator: Classic Burger'],
        ['#/recipes', language.key === 'en' ? 'Recipes' : 'Recepten'],
        ['#/ingredients', language.key === 'en' ? 'Ingredients' : 'Ingrediënten'],
        ['#/data', language.key === 'en' ? 'Data' : 'Gegevens'],
        ['#/help', language.key === 'en' ? 'MenuPilot: step-by-step guide' : 'MenuPilot: handleiding stap voor stap'],
      ] as const;

      for (const [route, heading] of pages) {
        await page.goto(route);
        await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
        await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/${route}`);
      }

      await page.goto('#/ingredients');
      await page.getByRole('button', { name: language.add, exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/add-ingredient-dialog`);

      await page.goto('#/data');
      await expect(page.getByRole('heading', { name: language.key === 'en' ? 'Data' : 'Gegevens', exact: true })).toBeVisible();
      await page.getByRole('button', { name: language.reset, exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/confirm-reset-dialog`);
    });
  }
}
