import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, createVerifiedUser, resetAccountRateLimits } from './support/accounts.js';
import { sql } from './support/alerts.js';

// Admin Pipeline and Model pages (Fase 4C), through Traefik like a real visitor. The e2e stack
// runs without the airflow profile, so the Pipeline page shows "Airflow tidak aktif"; the real
// Airflow is exercised in the 4C simulation.
test.describe.configure({ timeout: 120_000 });

test.beforeEach(() => {
  resetAccountRateLimits();
});

async function signInAdmin(page: Page, tag: string, back: string): Promise<void> {
  const email = await createVerifiedUser(tag);
  sql("UPDATE users SET role = 'admin' WHERE email = :'email';", email);
  await page.goto(`/masuk?ke=${encodeURIComponent(back)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL((url) => url.pathname === back, { timeout: 20_000 });
}

for (const width of [360, 1280] as const) {
  test(`pipeline page without Airflow, schedule saved with the password, at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInAdmin(page, `pipa${String(width)}`, '/admin/pipeline');
    await expect(page.getByRole('heading', { name: 'Jadwal latih ulang' })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Airflow tidak aktif' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.getByLabel('Jadwal latih ulang ARIF-Net').selectOption('monthly_first_monday');
    await page.getByLabel('Kata sandi Anda (konfirmasi)').fill(PASSWORD);
    await page.getByRole('button', { name: 'Simpan jadwal' }).click();
    await expect(page.getByText('Jadwal latih ulang disimpan.')).toBeVisible();
    await page.reload();
    await expect(page.getByText(/Sekarang: Senin pertama setiap bulan/)).toBeVisible();
    // Back to the default so other runs start from the same state.
    await page.getByLabel('Jadwal latih ulang ARIF-Net').selectOption('weekly_monday');
    await page.getByRole('button', { name: 'Simpan jadwal' }).click();
    await expect(page.getByText('Jadwal latih ulang disimpan.')).toBeVisible();
  });
}

test('a locked-run candidate is audited, cannot be approved, and is rejected with a reason', async ({
  page,
}) => {
  const run = `e2e-${randomUUID().slice(0, 8)}`;
  sql(
    `INSERT INTO model_candidates (run_id, bundle_id, bundle_sha256, model_version, data_end,
       lock_open, commodities, overall_relmae, scores, window_start, window_end)
     VALUES ('${run}', 'arifnet-${run}', repeat('c', 64), 'arifnet-a0-kp-${run}', '2026-09-30',
       false, ARRAY['cabai-merah-keriting','cabai-rawit-hijau'], 0.9, '{"cabai-merah-keriting":{"7":0.98,"90":1.2}}',
       '2024-09-30', '2025-09-30')`,
    'tidak-dipakai@contoh.id',
  );
  await signInAdmin(page, 'modelaudit', '/admin/model');
  await expect(page.getByRole('heading', { name: 'Kandidat model ARIF-Net' })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // Newest first: the candidate made by this test is the first row.
  await expect(
    page.getByRole('row').filter({ hasText: 'Terkunci (verifikasi)' }).first(),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Audit' }).first().click();
  await expect(page.getByRole('heading', { name: `arifnet-a0-kp-${run}` })).toBeVisible();
  await expect(page.getByText(/Terkunci: dilatih dengan data sampai 30 Sep 2026/)).toBeVisible();
  await expect(page.getByText(/Berkas: folder bundel kandidat tidak ditemukan/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Setujui dan aktifkan' })).toHaveCount(0);
  await expect(page.getByText(/Belum bisa disetujui: lihat gerbang audit/)).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  // A rejection without a reason is refused; with one it is kept, and nothing retrains (locked).
  await page.getByLabel('Kata sandi Anda (konfirmasi)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Tolak' }).click();
  await expect(page.getByText('Alasan wajib diisi.')).toBeVisible();
  await page
    .getByLabel('Alasan penolakan (wajib bila menolak)')
    .fill('Verifikasi e2e sebelum pembukaan');
  // The first submit stopped before the confirmation: the password is asked again.
  await page.getByLabel('Kata sandi Anda (konfirmasi)').fill(PASSWORD);
  await page.getByRole('button', { name: 'Tolak' }).click();
  await expect(
    page.getByText(/Latih ulang tidak dipicu karena uji prospektif masih terkunci/),
  ).toBeVisible();
});
