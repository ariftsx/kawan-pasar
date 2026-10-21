import { defineConfig } from '@playwright/test';

const PORT = 3100;

// Smoke tests use the `request` fixture only, so no browser download is needed yet.
// Browser-based E2E (golden path, axe, visual) arrives with the first real screens.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${String(PORT)}` },
  webServer: {
    command: `pnpm exec next start --port ${String(PORT)} --hostname 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}/api/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
