import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
// Set E2E_BASE_URL to test a running stack (e.g. http://localhost:3000 with api and model up);
// otherwise Playwright starts `next start` itself and the outlook is simply unavailable.
const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${String(PORT)}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: BASE_URL, locale: 'id-ID', timezoneId: 'Asia/Jakarta' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // docs 09 §10 UX-01: the smallest supported phone.
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 740 } },
      testIgnore: /smoke/,
    },
  ],
  ...(process.env.E2E_BASE_URL === undefined
    ? {
        webServer: {
          command: `pnpm exec next start --port ${String(PORT)} --hostname 127.0.0.1`,
          url: `${BASE_URL}/api/healthz`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          // No api in this mode: an unreachable address exercises the "outlook unavailable"
          // path (the BFF answers 503) instead of a missing-configuration error.
          env: { API_INTERNAL_URL: 'http://127.0.0.1:9', SERVICE_TOKEN: 'e2e-'.padEnd(40, 'x') },
        },
      }
    : {}),
});
