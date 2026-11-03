// v0.4 main path: Beranda → Harga → Detail → Prediksi, in demo mode, with axe on every screen.
// Without the api the outlook is unavailable, so the forecast states are checked too.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Serious and critical WCAG 2.2 AA violations fail the test. */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

test('Beranda shows the labelled sample and the main action', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cek harga dulu');
  await expect(page.getByText('DATA DEMO').first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Lihat harga hari ini/ }).first()).toBeInViewport();
  await expectAccessible(page);
});

test('Harga → Detail komoditas', async ({ page }) => {
  await page.goto('/harga');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Harga pangan hari ini');
  await expectAccessible(page);

  await page.getByRole('link', { name: 'Bawang merah' }).first().click();
  await page.waitForURL('/harga/bawang-merah');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bawang merah');
  await expect(page.getByRole('heading', { name: 'Konteks yang tersedia' })).toBeVisible();
  await expectAccessible(page);
});

test('an unknown commodity shows the not-found page', async ({ page }) => {
  // The route streams (partial prerender), so the status is already sent; the page says it.
  await page.goto('/harga/gula-pasir');
  await expect(page.getByText('Halaman tidak ditemukan')).toBeVisible();
});

test('Prediksi says when the forecast cannot be loaded', async ({ page }) => {
  await page.goto('/prediksi?komoditas=cabai-merah-keriting&horizon=7');
  await expect(page.getByRole('heading', { name: 'Prediksi gagal dimuat' })).toBeVisible();
  await expectAccessible(page);
});

test('Prediksi marks commodities that are not modelled yet', async ({ page }) => {
  await page.goto('/prediksi?komoditas=cabai-rawit-merah');
  await expect(
    page.getByRole('heading', { name: /Prediksi Cabai rawit merah menyusul/i }),
  ).toBeVisible();
});

for (const path of [
  '/peringatan',
  '/edukasi',
  '/edukasi/inflasi-pangan',
  '/arif-net',
  '/arif-net/keterbatasan',
  '/analis',
  '/pasar',
  '/lainnya',
] as const) {
  test(`${path} renders and is accessible`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectAccessible(page);
  });
}

test('Kapa bobs on Beranda but stays still for reduced motion', async ({ page }) => {
  await page.goto('/');
  const rig = page.locator('.kapa-animated .kapa-rig').first();
  await expect(rig).toHaveCount(1);
  expect(await rig.evaluate((node) => getComputedStyle(node).animationName)).not.toBe('none');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await rig.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});
