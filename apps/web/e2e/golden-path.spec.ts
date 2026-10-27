// F1 golden path (docs 21 §3): from an empty device to the cost of a menu, in demo mode.
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Serious and critical WCAG 2.2 AA violations fail the test (F1-X6). */
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === 'serious' || violation.impact === 'critical',
  );
  expect(blocking.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
}

async function setUpGeprek(page: Page) {
  await page.goto('/atur-warung');
  await page.getByRole('button', { name: 'Ayam Geprek / Penyet' }).click();
  await page.getByRole('button', { name: 'Lanjut', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pilih menu dan porsi per hari' })).toBeVisible();
  await page.getByRole('button', { name: /Lanjut \(3 menu\)/ }).click();
  await page.getByRole('button', { name: 'Lewati & lihat modal' }).click();
  await page.waitForURL('/');
}

test('public home is accessible and shows the labelled sample', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('modal satu porsi');
  await expect(page.getByText('DATA DEMO').first()).toBeVisible();
  await expectAccessible(page);
});

test('Si Bakul waves on the public home but stays still for reduced motion', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Saya bantu hitung modal bahan')).toBeVisible();
  const wave = page.locator('.motion-safe\\:animate-bakul-wave');
  await expect(wave).toHaveCount(1);
  expect(await wave.evaluate((node) => getComputedStyle(node).animationName)).toBe('bakul-wave');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await wave.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});

test('empty device → Atur Warung → personal Beranda in under 60 s (F1-X1, UX-01)', async ({
  page,
}) => {
  const started = Date.now();
  await setUpGeprek(page);
  await expect(page.getByRole('heading', { name: 'Ringkasan dapur hari ini' })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);

  // UX-01: the cost is visible without scrolling, even at 360×740.
  const cost = page.getByText('Modal bahan hari ini');
  await expect(cost).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'Ayam Geprek + Nasi' })).toBeVisible();
  await expectAccessible(page);
});

test('Rencana shows the plan and the data survives a reload (F1-X5)', async ({ page }) => {
  await setUpGeprek(page);
  await page.goto('/rencana');
  await expect(page.getByRole('heading', { name: 'Rencana Menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Pecel Lele + Nasi' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Tahu Tempe Penyet + Nasi' })).toBeVisible();
  await expect(page.getByText('Hitungan biasa, bukan perkiraan model.')).toBeVisible();
  await expectAccessible(page);
});

test('Rincian reproduces the DATA DEMO example and edits the menu (F1-X7)', async ({ page }) => {
  await setUpGeprek(page);
  await page.goto('/rencana');
  await page.getByRole('link', { name: 'Ayam Geprek + Nasi' }).click();
  await expect(page.getByRole('textbox', { name: 'Nama menu' })).toHaveValue('Ayam Geprek + Nasi');

  // Rp 10.850 per portion, the official example (docs 05 §4).
  const metrics = page.getByRole('region', { name: 'Modal per porsi' });
  await expect(metrics).toContainText('10.850');

  // Steppers show stored values unchanged (React Aria snaps to step from minValue).
  await expect(page.getByRole('textbox', { name: 'Beras medium' })).toHaveValue('120');
  await expect(page.getByRole('textbox', { name: 'Bumbu lain' })).toHaveValue('12');
  await expect(page.getByRole('textbox', { name: 'Porsi per hari' })).toHaveValue('100');
  await expect(page.getByRole('textbox', { name: 'Harga jual per porsi' })).toHaveValue(/15\.000/);

  // Removing chilli lowers the cost; the change is saved on the device.
  await page.getByRole('button', { name: 'Hapus Cabai merah keriting' }).click();
  await expect(metrics).not.toContainText('10.850');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Hapus Cabai merah keriting' })).toHaveCount(0);
  await expectAccessible(page);
});

test('a custom menu without a price shows a dash, never Rp 0 (UX-04)', async ({ page }) => {
  await setUpGeprek(page);
  await page.goto('/rencana');
  await page.getByRole('button', { name: 'Tambah menu sendiri' }).click();
  await expect(page.getByRole('textbox', { name: 'Nama menu' })).toHaveValue('Menu baru');
  const metrics = page.getByRole('region', { name: 'Modal per porsi' });
  await expect(metrics).toContainText('Belum tersedia');
  await expect(metrics).not.toContainText('Rp 0');
});

test('guest data can be exported as JSON (ONB-03)', async ({ page }) => {
  await setUpGeprek(page);
  await page.goto('/rencana');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor data (JSON)' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^kawan-pasar-\d{4}-\d{2}-\d{2}\.json$/);
});

test('routes for later phases explain themselves instead of a 404', async ({ page }) => {
  await page.goto('/pantau');
  await expect(page.getByText('Segera hadir', { exact: true })).toBeVisible();
  await expect(page.getByText('Dikerjakan pada tahap F2.')).toBeVisible();
  await expectAccessible(page);
});
