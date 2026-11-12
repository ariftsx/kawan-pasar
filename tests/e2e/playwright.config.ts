import { defineConfig, devices } from '@playwright/test';

/**
 * End-user simulation against the running Docker stack, through Traefik (the same path a
 * visitor takes). Start it first: `pnpm infra:up`.
 */
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:8080',
    locale: 'id-ID',
    timezoneId: 'Asia/Jakarta',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
