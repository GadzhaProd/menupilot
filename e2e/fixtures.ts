import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ blockedExternalUrls: string[] }>({
  blockedExternalUrls: async ({ page }, use) => {
    const urls: string[] = [];
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1') await route.continue();
      else {
        urls.push(url.href);
        await route.abort();
      }
    });
    await use(urls);
  },
});

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00.000Z') });
  await page.goto('./');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test.afterEach(async ({ blockedExternalUrls }) => {
  expect(blockedExternalUrls, 'No test should attempt an external network request').toEqual([]);
});

export { expect };
