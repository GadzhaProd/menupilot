import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ blockedExternalUrls: string[] }>({
  // An automatic fixture depending on the browser context is installed before
  // beforeEach hooks, so every page (including extra tabs) is guarded before goto.
  blockedExternalUrls: [async ({ context, baseURL }, use) => {
    const urls: string[] = [];
    const appOrigin = new URL(baseURL ?? 'http://127.0.0.1:4174/menupilot/').origin;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin === appOrigin) await route.continue();
      else {
        urls.push(url.href);
        await route.abort();
      }
    });
    await use(urls);
  }, { auto: true }],
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
