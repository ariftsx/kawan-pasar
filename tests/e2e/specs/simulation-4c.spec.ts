import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, createVerifiedUser, resetAccountRateLimits } from './support/accounts.js';
import { sql } from './support/alerts.js';

// Fase 4C end-user simulation with the REAL Airflow (profile airflow running), the prospective
// lock closed. Not part of the e2e gate: run with SIM_4C=1. It uses the real candidates of the
// dev database (bundles under data/pipeline/runs) and triggers one real retraining run (quota).
test.skip(process.env['SIM_4C'] !== '1', 'simulation only (SIM_4C=1, airflow profile up)');
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const SHOTS = '../../docs/audits/fase-4c';
mkdirSync(SHOTS, { recursive: true });

async function signInAdmin(page: Page): Promise<void> {
  resetAccountRateLimits();
  const email = await createVerifiedUser('simulasi4c');
  sql("UPDATE users SET role = 'admin' WHERE email = :'email';", email);
  await page.goto('/masuk?ke=%2Fadmin%2Fpipeline');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/admin\/pipeline$/, { timeout: 20_000 });
}

test('admin follows the locked pipeline, triggers a verification run, audits and rejects', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await signInAdmin(page);

  // Pipeline page: the lock from status_kunci, runs from Airflow.
  await expect(page.getByText('Menunggu pembukaan uji prospektif')).toBeVisible();
  await expect(page.getByText(/OPENED\.json belum ada/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Latih ulang ARIF-Net' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pipeline-terkunci.png`, fullPage: true });

  // A manual retraining run (verification while locked).
  const train = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Latih ulang ARIF-Net' }) });
  await train.getByLabel('Kata sandi Anda (konfirmasi)').fill(PASSWORD);
  await train.getByRole('button', { name: 'Latih ulang sekarang' }).click();
  await expect(train.getByText(/Run baru sudah dipicu/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Latih ulang manual hari ini: [1-3] dari 3/)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pipeline-dipicu.png`, fullPage: true });

  // Model page: the newest real candidate is a locked one (verification only).
  await page.getByRole('link', { name: 'Model' }).click();
  await expect(page.getByRole('heading', { name: 'Kandidat model ARIF-Net' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/model-daftar.png`, fullPage: true });
  await page
    .getByRole('row')
    .filter({ hasText: 'Menunggu audit' })
    .filter({ hasText: 'Terkunci (verifikasi)' })
    .getByRole('link', { name: 'Audit' })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Gerbang audit' })).toBeVisible();
  // The real bundle passes the promotion verifier; only the protocol blocks it.
  await expect(page.getByText(/Bundel lolos verifikator promosi/)).toBeVisible();
  await expect(page.getByText(/Terkunci: dilatih dengan data sampai 30 Sep 2026/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Setujui dan aktifkan' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/model-audit-terkunci.png`, fullPage: true });

  await page
    .getByLabel('Alasan penolakan (wajib bila menolak)')
    .fill('Simulasi 4C: verifikasi sebelum pembukaan uji prospektif');
  await page.getByRole('button', { name: 'Tolak' }).click();
  await expect(
    page.getByText(/Latih ulang tidak dipicu karena uji prospektif masih terkunci/),
  ).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/model-ditolak.png`, fullPage: true });
});
