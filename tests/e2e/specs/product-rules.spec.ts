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

test('commodities without data show "—" and a pending forecast', async ({ page }) => {
  await page.goto('/harga');
  const row = page.getByRole('row').filter({ hasText: 'Cabai rawit hijau' });
  await expect(row).toContainText('—');
  await expect(row).toContainText('Prediksi menyusul');
});

test('every page with forecast numbers shows the model version, the demo label and the disclaimer', async ({
  page,
}) => {
  for (const path of FORECAST_PAGES) {
    await page.goto(path);
    const text = await page.locator('main').innerText();
    expect(text, path).toContain('demo-empirical-quantile-v1');
    expect(text, path).toContain('Data demo');
    expect(text, path).toMatch(/bukan jaminan harga/i);
  }
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
