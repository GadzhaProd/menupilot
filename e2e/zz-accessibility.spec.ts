import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

const languages = [
  {
    key: 'en', button: 'EN – English', add: 'Add ingredient', reset: 'Reset to demo data',
    saveDish: 'Save dish', validationSummary: 'Some fields need attention. They are marked above.',
    validationName: 'Enter a name.', addScenario: 'Add scenario', scenarioName: 'Scenario name',
    saveScenario: 'Save scenario', deleteScenario: 'Delete',
  },
  {
    key: 'nl', button: 'NL – Nederlands', add: 'Ingrediënt toevoegen', reset: 'Terugzetten naar voorbeeldgegevens',
    saveDish: 'Gerecht opslaan', validationSummary: 'Sommige velden vragen aandacht. Ze zijn hierboven gemarkeerd.',
    validationName: 'Vul een naam in.', addScenario: 'Scenario toevoegen', scenarioName: 'Scenarionaam',
    saveScenario: 'Scenario opslaan', deleteScenario: 'Verwijderen',
  },
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
      // Establish a known route before selecting the theme; mobile's first project can begin on about:blank.
      await page.goto('./');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (language.key === 'nl') {
        await page.getByRole('button', { name: language.button, exact: true }).click();
      }
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

      await page.goto('#/recipe/new?kind=dish');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/recipe-editor`);
      await page.getByRole('button', { name: language.saveDish, exact: true }).click();
      await expect(page.getByText(language.validationSummary, { exact: true })).toBeVisible();
      await expect(page.getByText(language.validationName, { exact: true })).toBeVisible();
      await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/recipe-validation-errors`);

      await page.goto('#/simulator/dish_classic_burger');
      await page.getByRole('button', { name: language.addScenario, exact: true }).click();
      const scenario = page.getByRole('region', { name: 'Scenario A', exact: true });
      await expect(scenario.getByLabel(language.scenarioName, { exact: true })).toBeVisible();
      await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/simulator-scenario`);
      await scenario.getByRole('button', { name: language.saveScenario, exact: true }).click();
      await expect(scenario.getByText(language.key === 'en' ? 'Saved.' : 'Opgeslagen.', { exact: true })).toBeVisible();
      await scenario.getByRole('button', { name: language.deleteScenario, exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expectNoSeriousAxeViolations(page, `${language.key}/${theme}/simulator-delete-scenario-dialog`);

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
