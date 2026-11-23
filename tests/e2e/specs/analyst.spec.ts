import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, createVerifiedUser, resetAccountRateLimits } from './support/accounts.js';
import { sql } from './support/alerts.js';

// Mode Analis (Fase 3A): public comparison, role request on /akun, CSV for analysts.
test.describe.configure({ timeout: 90_000 });

const BOM = String.fromCharCode(0xfeff);

test.beforeEach(() => {
  resetAccountRateLimits();
});

async function signIn(page: Page, email: string, back: string): Promise<void> {
  await page.goto(`/masuk?ke=${encodeURIComponent(back)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL((url) => url.pathname === back, { timeout: 20_000 });
}

for (const width of [360, 1280] as const) {
  test(`public comparison chart at ${String(width)} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/analis');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Bandingkan harga/);
    const chart = page.getByRole('img', { name: /^Grafik Indeks/ });
    await expect(chart).toBeVisible();
    await page.getByLabel('Metrik').selectOption('harga');
    await expect(page.getByRole('img', { name: /^Grafik Harga/ })).toBeVisible();
    await page.getByRole('button', { name: '90H' }).click();
    await expect(page.getByRole('button', { name: '90H' })).toHaveAttribute('aria-pressed', 'true');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('chart, coverage and forecast table are server-rendered', async ({ page }) => {
    await page.goto('/analis');
    await expect(page.getByRole('img', { name: /^Grafik Indeks/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cakupan data' })).toBeVisible();
    const table = page.getByRole('table', { name: /Perkiraan perubahan harga/ });
    await expect(table.getByRole('rowheader')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Unduh harga.csv' })).toBeVisible();
  });
});

test('a visitor who downloads is asked to sign in first', async ({ page }) => {
  await page.goto('/analis');
  await page.getByRole('button', { name: 'Unduh harga.csv' }).click();
  await expect(page).toHaveURL(/\/masuk\?ke=%2Fanalis$/);
});

test('request the role, then download as an analyst', async ({ page }) => {
  const email = await createVerifiedUser('analis');
  await signIn(page, email, '/akun');
  const panel = page.getByRole('region', { name: 'Mode Analis' });
  await expect(panel).toContainText('Peran: Pengguna');

  // Without the role the download leads back to the request form.
  await page.goto('/analis');
  await page.getByRole('button', { name: 'Unduh harga.csv' }).click();
  await expect(page).toHaveURL(/\/akun#mode-analis$/);

  await panel.getByLabel('Untuk apa data ini?').fill('Skripsi tentang inflasi pangan Jakarta');
  await panel.getByLabel('Instansi (opsional)').fill('UMB');
  await panel.getByRole('button', { name: 'Ajukan peran Analis' }).click();
  await expect(panel).toContainText('Pengajuan terkirim');
  await page.reload();
  await expect(panel).toContainText('sedang ditinjau');

  // Decided on the server (CLI until Fase 3B).
  // Same effect as `role:grant` (CLI): the role, and the pending request closed as approved.
  sql(
    `UPDATE users SET role = 'analyst' WHERE email = :'email';
     UPDATE analyst_requests SET status = 'approved', decided_at = now()
       WHERE status = 'pending' AND user_id = (SELECT id FROM users WHERE email = :'email');`,
    email,
  );
  await page.reload();
  await expect(panel).toContainText('Peran: Analis');

  await page.goto('/analis');
  await page.getByLabel('Bawang merah').check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Unduh harga.csv' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('kawan-pasar-harga.csv');
  const body = readFileSync(await download.path(), 'utf8').replace(BOM, '');
  const lines = body.trim().split('\r\n');
  expect(lines[0]).toBe('pasar,komoditas,nama,tanggal,harga_idr,sumber');
  expect(lines.length).toBeGreaterThan(100);
  expect(lines.slice(1).every((l) => l.startsWith('PIKJ,bawang-merah,'))).toBe(true);

  const [forecast] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Unduh prediksi.csv' }).click(),
  ]);
  expect(forecast.suggestedFilename()).toBe('kawan-pasar-prediksi.csv');
});
