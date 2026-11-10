import { test, expect } from './fixtures';
import { markPriceDocument } from '../test/store/fixtures.js';

export function markPriceTests() {
  for (const locale of ['en', 'nl'] as const) {
    test(`Mark adds every missing invoice price including prep ingredients (${locale})`, async ({ page }, info) => {
      const doc = markPriceDocument();
      await page.evaluate(doc => localStorage.setItem('menupilot:v1', JSON.stringify({ version: 2, schemaVersion: 2, documentId: 'mark', revision: 1, document: doc })), doc);
      await page.reload();
      if (locale === 'nl') await page.getByRole('button', { name: 'NL – Nederlands' }).click();
      const missing = () => page.getByTestId('missing-prices').filter({ visible: true });
      const dashboard = async () => {
        await page.goto('./#/');
        await page.getByLabel(locale === 'en' ? 'Choose date' : 'Kies een datum', { exact: true }).fill('2026-10-11');
      };
      const addInvoice = async (name: string, price: string) => {
        await page.goto('./#/ingredients');
        await page.getByRole('button', { name: locale === 'en' ? `New price for ${name}` : `Nieuwe prijs voor ${name}`, exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel(locale === 'en' ? /Pack price/ : /Verpakkingsprijs/).fill(price);
        await dialog.getByLabel(locale === 'en' ? 'Price valid from' : 'Prijs geldig vanaf', { exact: true }).fill('2026-10-10');
        await dialog.getByRole('button', { name: locale === 'en' ? 'Save price' : 'Prijs opslaan', exact: true }).click();
        await expect(dialog).toHaveCount(0);
      };
      await addInvoice('Beef mince', '17.00');
      await dashboard();
      await expect(missing()).toContainText('Burger buns, Cheddar, Tomatoes');
      await expect(missing()).toContainText(locale === 'en' ? 'and 1 more' : 'en nog 1');
      await expect(missing()).not.toContainText('Beef mince');
      await expect(page.getByText(locale === 'en' ? /A comparison needs a price on this date for every ingredient/ : /Voor een vergelijking heeft elk ingrediënt/)).toBeVisible();
      await info.attach(`mark-missing-${locale}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
      for (const [name, price] of [['Burger buns', '10.56'], ['Cheddar', '13.20'], ['Tomatoes', '2.00']]) await addInvoice(name!, price!);
      await dashboard();
      await expect(missing()).toContainText('Onions');
      await expect(missing()).not.toContainText('Tomatoes');
      await expect(page.getByText(locale === 'en' ? /No dish has complete ingredient prices on/ : /heeft nog geen enkel gerecht volledige ingrediëntprijzen/).first()).toBeVisible();
      await addInvoice('Onions', '7.00');
      await dashboard();
      await expect(missing()).toHaveCount(0);
      const dish = (page.viewportSize()?.width ?? 1280) < 768
        ? page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Mark Burger', exact: true }) })
        : page.getByRole('row', { name: /Mark Burger/ });
      await expect(dish).toContainText(locale === 'en' ? '€4.43' : '€ 4,43');
      await expect(dish).toContainText(locale === 'en' ? '€4.88' : '€ 4,88');
      await expect(dish).toContainText(locale === 'en' ? '-€135.00' : '-€ 135,00');
      await info.attach(`mark-comparable-${locale}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    });
  }
}
