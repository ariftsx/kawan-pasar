import { expect, test } from '@playwright/test';
import { ALL_PAGES } from './support/pages.js';

/** Product rules from the design (§3) checked on the rendered pages. */
// Each test walks many pages; the first render of an ISR page after a rebuild is slow.
test.describe.configure({ timeout: 180_000 });
const FORECAST_PAGES = ['/beranda', '/harga', '/harga/cabai-merah-keriting', '/prediksi'] as const;

test('unknown values are never shown as zero rupiah anywhere', async ({ page }) => {
  for (const path of ALL_PAGES) {
    await page.goto(path);
    const text = await page.locator('body').innerText();
    expect(text, path).not.toMatch(/Rp\s?0(?![\d.])/);
  }
});

// Fase 4A: cabai rawit has PIHPS prices now (history up to the prospective-test ceiling), but no
// model covers it until an admin approves a 5-commodity bundle: its forecast stays pending.
test('commodities the model does not cover yet show their price and a pending forecast', async ({
  page,
}) => {
  await page.goto('/harga');
  const row = page.getByRole('row').filter({ hasText: 'Cabai rawit hijau' });
  await expect(row).toContainText(/Rp/);
  await expect(row).toContainText('Prediksi menyusul');
});

// The local stack serves the ARIF-Net bundle (`pnpm model:export`, Fase 2B): its version is
// shown, the demo label is not. (With only the demo bundle, the label rule is covered by unit tests.)
test('every page with forecast numbers shows the ARIF-Net version, no demo label, and the disclaimer', async ({
  page,
}) => {
  for (const path of FORECAST_PAGES) {
    await page.goto(path);
    const text = await page.locator('main').innerText();
    expect(text, path).toMatch(/arifnet-a0-v1\.1\.0\+[0-9a-f]{8}/);
    expect(text, path).not.toContain('Data demo');
    expect(text, path).not.toContain('demo-empirical-quantile-v1');
    expect(text, path).toMatch(/bukan jaminan harga/i);
  }
});

test('a horizon where ARIF-Net did not beat "price unchanged" is marked "Sebagian"', async ({
  page,
}) => {
  await page.goto('/prediksi/beras-medium-1');
  const table = page.getByRole('table').filter({ hasText: 'Status uji' });
  await expect(table.getByRole('row').filter({ hasText: '7 hari' })).toContainText('Sebagian');
  await expect(table.getByRole('row').filter({ hasText: '30 hari' })).toContainText('Tersedia');
});

test('no causal or buy/sell language in generated copy', async ({ page }) => {
  for (const path of FORECAST_PAGES) {
    await page.goto(path);
    const tips = await page.locator('aside').allInnerTexts();
    for (const t of tips) {
      expect(t, path).not.toMatch(
        /\b(karena|sebaiknya beli|segera beli|jual sekarang|pasti naik|pasti turun)\b/i,
      );
    }
  }
});

test('stale data is announced', async ({ page }) => {
  await page.goto('/beranda');
  await expect(
    page.getByRole('status').filter({ hasText: 'Harga belum diperbarui' }),
  ).toBeVisible();
});
