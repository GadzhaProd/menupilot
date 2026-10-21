import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/local',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 8000 },
  outputDir: 'test-results-local',
  use: { actionTimeout: 10000, browserName: 'chromium', serviceWorkers: 'block', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'local-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'local-mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 }, deviceScaleFactor: 1 } },
  ],
});
