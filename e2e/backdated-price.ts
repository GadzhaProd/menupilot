import { test, expect } from './fixtures';

export function backdatedPriceTests() {
  for (const locale of ['en', 'nl'] as const) {
    test(`new owner adds an earlier invoice after today's prices (${locale})`, async ({ page }, info) => {
      const doc = {
        version: 1, settings: { defaultVatRateBp: 900 }, scenarios: [],
        ingredients: [{ id: 'flour', name: 'Flour', unit: 'g', prices: [{ seq: 1, recordedAt: '2026-10-20T12:00:00.000Z', packPriceCents: 800, packSizeMilli: 1000000 }] }],
        recipes: [{ id: 'soup', name: 'Soup', kind: 'dish', menuPriceInclVatCents: 1500, vatRateBp: 900, portions: 1, monthlyVolume: 100,
          lines: [{ id: 'line', ref: { kind: 'ingredient', id: 'flour' }, netQtyMilli: 1000000, yieldBp: 10000 }] }],
      };
      await page.evaluate(doc => localStorage.setItem('menupilot:v1', JSON.stringify({ version: 2, schemaVersion: 2, documentId: 'backdated', revision: 1, document: doc })), doc);
      await page.reload();
      if (locale === 'nl') await page.getByRole('button', { name: 'NL – Nederlands' }).click();
      await expect(page.getByText(locale === 'en' ? /No dish has complete ingredient prices on/ : /heeft nog geen enkel gerecht volledige ingrediëntprijzen/).first()).toBeVisible();
      await page.goto('./#/ingredients');
      const newPrice = page.getByRole('button', { name: locale === 'en' ? 'New price for Flour' : 'Nieuwe prijs voor Flour', exact: true });
      await newPrice.click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('status')).toContainText(locale === 'en' ? 'already a price on this date' : 'al een prijs op deze datum');
      const price = dialog.getByLabel(locale === 'en' ? /Pack price/ : /Verpakkingsprijs/);
      const date = dialog.getByLabel(locale === 'en' ? 'Price valid from' : 'Prijs geldig vanaf', { exact: true });
      const save = dialog.getByRole('button', { name: locale === 'en' ? 'Save price' : 'Prijs opslaan', exact: true });
      await price.fill('3.00');
      await price.focus(); await page.keyboard.press('Tab');
      await expect(date).toBeFocused();
      await date.fill('1999-12-31'); await save.click();
      await expect(date).toBeFocused(); await expect(date).toHaveAttribute('aria-invalid', 'true');
      await date.fill('2026-09-01');
      await expect(dialog.getByRole('status')).toHaveCount(0);
      await info.attach(`backdated-form-${locale}`, { body: await page.screenshot(), contentType: 'image/png' });
      await save.click(); await expect(dialog).toHaveCount(0);
      await expect(newPrice).toBeFocused();
      await page.getByRole('button', { name: locale === 'en' ? 'Price history of Flour' : 'Prijsgeschiedenis van Flour', exact: true }).click();
      const rows = page.getByRole('dialog').getByRole('row');
      await expect(rows.nth(1)).toContainText(locale === 'en' ? '€8.00' : '€ 8,00');
      await expect(rows.nth(2)).toContainText(locale === 'en' ? '€3.00' : '€ 3,00');
      await page.keyboard.press('Escape');
      await page.goto('./#/');
      if ((page.viewportSize()?.width ?? 1280) < 768) {
        const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Soup', exact: true }) });
        const values = card.getByRole('definition');
        await expect(values.nth(0)).toHaveText(locale === 'en' ? '€3.00' : '€ 3,00');
        await expect(values.nth(1)).toHaveText(locale === 'en' ? '€8.00' : '€ 8,00');
        await expect(values.nth(2)).toContainText(locale === 'en' ? '€5.00' : '€ 5,00');
        await expect(card).toContainText(locale === 'en' ? '-€500.00' : '-€ 500,00');
      } else {
        const cells = page.getByRole('row', { name: /Soup/ }).getByRole('cell');
        await expect(cells.nth(1)).toHaveText(locale === 'en' ? '€3.00' : '€ 3,00');
        await expect(cells.nth(2)).toHaveText(locale === 'en' ? '€8.00' : '€ 8,00');
        await expect(cells.nth(3)).toContainText(locale === 'en' ? '€5.00' : '€ 5,00');
        await expect(cells.nth(5)).toContainText(locale === 'en' ? '-€500.00' : '-€ 500,00');
      }
      await info.attach(`backdated-dashboard-${locale}`, { body: await page.screenshot(), contentType: 'image/png' });
    });
  }
}
