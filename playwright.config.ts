import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Separate ports and database, so the tests never touch data from `npm run dev:all`.
const API_PORT = 5199;
const WEB_PORT = 5198;
export const SEPAY_TEST_KEY = 'e2e-webhook-key';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    {
      command: 'node server/server.js',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        PORT: String(API_PORT),
        DATABASE_PATH: path.join(os.tmpdir(), 'hostelmate-e2e.sqlite'),
        RESET_DB_ON_START: 'true',
        JWT_SECRET: 'e2e-jwt-secret',
        SEPAY_WEBHOOK_API_KEY: SEPAY_TEST_KEY,
        SEPAY_ALLOWED_ACCOUNT_NUMBERS: '',
        BANK_ID: '970422',
        BANK_ACCOUNT_NO: '0123456789',
        BANK_ACCOUNT_NAME: 'HOSTELMATE DEMO',
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
