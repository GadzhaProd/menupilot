import { defineConfig, devices } from '@playwright/test';

const desktopTests = ['**/desktop.spec.ts', '**/zz-accessibility.spec.ts'];
const mobileTests = ['**/mobile.spec.ts', '**/zz-accessibility.spec.ts'];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  outputDir: 'test-results-compat',
  use: {
    baseURL: 'http://127.0.0.1:4174/menupilot/',
    actionTimeout: 10_000,
    navigationTimeout: 10_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'webkit-desktop', testMatch: desktopTests, use: { ...devices['Desktop Safari'], browserName: 'webkit', viewport: { width: 1280, height: 800 } } },
    { name: 'webkit-mobile', testMatch: mobileTests, use: { ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 } },
    { name: 'firefox-desktop', testMatch: desktopTests, use: { ...devices['Desktop Firefox'], browserName: 'firefox', viewport: { width: 1280, height: 800 } } },
    { name: 'firefox-mobile', testMatch: mobileTests, use: { ...devices['Desktop Firefox'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 } },
  ],
  webServer: {
    command: process.env.CI
      ? 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort'
      : 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174/menupilot/',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
