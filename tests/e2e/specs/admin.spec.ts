import { randomUUID } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, createVerifiedUser, resetAccountRateLimits } from './support/accounts.js';
import { sql } from './support/alerts.js';

// Admin (Fase 3B), through Traefik like a real visitor. Admins are made by SQL here (the CLI
// does the same: admin is never granted from the web).
test.describe.configure({ timeout: 120_000 });

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

async function admin(tag: string): Promise<string> {
  const email = await createVerifiedUser(tag);
  sql("UPDATE users SET role = 'admin' WHERE email = :'email';", email);
  return email;
}

test('the admin area does not exist for users and analysts (404), and needs a session', async ({
  page,
}) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/masuk\?ke=%2Fadmin$/);
  const email = await createVerifiedUser('bukanadmin');
  sql("UPDATE users SET role = 'analyst' WHERE email = :'email';", email);
  await signIn(page, email, '/akun');
  const res = await page.goto('/admin');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Buka Admin' })).toHaveCount(0);
});

for (const width of [360, 1280] as const) {
  test(`decide a request with the password asked inline, at ${String(width)} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const asker = await createVerifiedUser(`pengaju${String(width)}`);
    // Unique per run: earlier runs may have left other pending requests in the dev database.
    const reason = `Skripsi inflasi pangan ${randomUUID().slice(0, 8)}`;
    sql(
      `INSERT INTO analyst_requests (user_id, reason) SELECT id, '${reason}' FROM users WHERE email = :'email';`,
      asker,
    );
    await signIn(page, await admin(`admin${String(width)}`), '/akun');
    await page.getByRole('link', { name: 'Buka Admin' }).click();
    await expect(page.getByRole('heading', { name: 'Pengajuan peran Analis' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const item = page.getByRole('listitem').filter({ hasText: reason });
    await expect(item).toContainText(`${asker.slice(0, 1)}***@contoh.id`);
    // No confirmation yet: the password field is part of the form.
    await item.getByLabel('Kata sandi Anda (konfirmasi)').fill(PASSWORD);
    await item.getByRole('button', { name: 'Setujui' }).click();
    await expect(page.getByRole('status')).toContainText('Keputusan tersimpan');
    await expect(page.getByText(/Perubahan tanpa kata sandi sampai/)).toBeVisible();
    await expect(page.getByText(reason)).toHaveCount(0);
  });
}

test('write a draft, preview it, publish it to Edukasi, then withdraw it', async ({ page }) => {
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  try {
    await signIn(page, await admin('penulis'), '/akun');
    await page.goto('/admin/artikel/baru');
    await page.getByLabel('Slug (alamat artikel)').fill(slug);
    await page.getByLabel('Judul').fill('Harga cabai saat musim hujan');
    await page.getByLabel('Ringkasan').fill('Mengapa harga cabai sering naik saat hujan.');
    // An unsafe link is refused with a reason, and nothing typed is lost.
    await page
      .getByLabel('Isi (Markdown)')
      .fill('## Pasokan\n\nHujan mengganggu panen. [klik](javascript:alert(1))');
    await page.getByLabel('Kata sandi Anda (konfirmasi)').fill(PASSWORD);
    await page.getByRole('button', { name: 'Simpan draf' }).click();
    await expect(page.getByText(/Tautan hanya boleh https/).first()).toBeVisible();
    await expect(page.getByLabel('Judul')).toHaveValue('Harga cabai saat musim hujan');

    await page
      .getByLabel('Isi (Markdown)')
      .fill(
        '## Pasokan\n\nHujan mengganggu panen. Lihat [harga cabai](/harga/cabai-merah-keriting).',
      );
    await page.getByRole('button', { name: 'Simpan draf' }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/artikel/${slug}\\?pesan=disimpan$`));
    const preview = page.getByRole('region', { name: 'Pratinjau (versi tersimpan)' });
    await expect(preview.getByRole('heading', { name: 'Pasokan' })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    expect((await page.request.get(`/edukasi/${slug}`)).status()).toBe(404);
    await page.getByRole('button', { name: 'Terbitkan' }).click();
    await expect(page.getByRole('status')).toContainText('Artikel terbit');
    await page.goto(`/edukasi/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Harga cabai saat musim hujan',
    );

    await page.goto(`/admin/artikel/${slug}`);
    await page.getByRole('button', { name: 'Tarik dari situs' }).click();
    await expect(page.getByRole('status')).toContainText('Artikel ditarik');
    expect((await page.request.get(`/edukasi/${slug}`)).status()).toBe(404);
  } finally {
    sql(`DELETE FROM articles WHERE slug = '${slug}';`, 'tidak-dipakai@contoh.id');
  }
});
