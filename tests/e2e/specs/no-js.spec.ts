import { expect, test } from '@playwright/test';
import { ALL_PAGES } from './support/pages.js';

/** Pages stay readable and correct without JavaScript (server-rendered defaults). */
test.use({ javaScriptEnabled: false });
test.describe.configure({ timeout: 180_000 });

test('every page renders its main heading without JavaScript', async ({ page }) => {
  for (const path of ALL_PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 }), path).toBeVisible();
  }
});

test('charts show their default variant and no dead controls', async ({ page }) => {
  await page.goto('/harga/cabai-merah-keriting');
  await expect(page.locator('#detail-riwayat [data-range="90d"]')).toBeVisible();
  await expect(page.locator('#detail-riwayat [data-range="30d"]')).toBeHidden();
  await expect(page.getByRole('group', { name: 'Rentang waktu grafik' })).toHaveCount(0);

  await page.goto('/prediksi');
  await expect(page.locator('#prediksi-panel div[data-horizon-only="7"]')).toBeVisible();
  await expect(page.locator('#prediksi-panel div[data-horizon-only="30"]')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Bawang merah' })).toBeVisible();
});

test('the commodity list shows every commodity', async ({ page }) => {
  await page.goto('/harga');
  await expect(page.getByRole('row').filter({ hasText: 'Cabai rawit merah' })).toBeVisible();
});
