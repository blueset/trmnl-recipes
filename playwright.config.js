import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/holiday-editor-ui',
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5000 },
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  reporter: 'list',
  webServer: {
    command: 'npm run build:pages && npm run preview:pages',
    url: 'http://127.0.0.1:4173/holiday-editor/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
