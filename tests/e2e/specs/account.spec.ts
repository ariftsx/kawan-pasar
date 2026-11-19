import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import {
  PASSWORD,
  createVerifiedUser,
  latestMail,
  linkTo,
  newEmail,
  resetAccountRateLimits,
} from './support/accounts.js';

// End-user journeys of Fase 2A (accounts), through Traefik like a real visitor.

const NEW_PASSWORD = 'harga cabai turun minggu ini';

test.beforeEach(() => {
  resetAccountRateLimits();
});

async function signIn(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/masuk');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/akun$/);
}

async function signedInContext(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);
  return page;
}

for (const width of [360, 1280] as const) {
  test.describe(`${String(width)} px`, () => {
    test.use({ viewport: { width, height: 800 } });

    test('register, verify the e-mail from the inbox, sign in, see the account', async ({
      page,
    }) => {
      const email = newEmail(`daftar${String(width)}`);
      await page.goto('/daftar');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
      await page.getByLabel('Ulangi kata sandi').fill(PASSWORD);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Buat akun' }).click();
      await expect(page.getByRole('status')).toContainText('Cek kotak masuk email Anda');

      const mail = await latestMail(email, 'Verifikasi email');
      await page.goto(linkTo(mail.text, '/verifikasi-email'));
      await page.getByRole('button', { name: 'Verifikasi email saya' }).click();
      await expect(page.getByRole('status')).toContainText('sudah terverifikasi');

      await signIn(page, email);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Akun saya');
      await expect(page.getByText(email)).toBeVisible();
      await expect(page.getByText('✓ Terverifikasi')).toBeVisible();
    });
  });
}

test('forgot password: the e-mailed link sets a new password, the old one stops working', async ({
  page,
}) => {
  const email = await createVerifiedUser('lupa');
  await page.goto('/lupa-sandi');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Kirim tautan' }).click();
  await expect(page.getByRole('status')).toContainText('Bila email itu terdaftar');

  const mail = await latestMail(email, 'Atur ulang kata sandi');
  await page.goto(linkTo(mail.text, '/atur-ulang-sandi'));
  await page.getByLabel('Kata sandi baru', { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel('Ulangi kata sandi baru').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
  await expect(page).toHaveURL(/\/masuk\?pesan=sandi-diubah$/);
  await expect(page.getByRole('status')).toContainText('berhasil diatur ulang');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('Email atau kata sandi salah.');
  await signIn(page, email, NEW_PASSWORD);
});

test('changing the password signs out the other devices', async ({ browser }) => {
  const email = await createVerifiedUser('ganti');
  const here = await signedInContext(browser, email);
  const there = await signedInContext(browser, email);

  await here.getByLabel('Kata sandi saat ini', { exact: true }).fill(PASSWORD);
  await here.getByLabel('Kata sandi baru', { exact: true }).fill(NEW_PASSWORD);
  await here.getByLabel('Ulangi kata sandi baru').fill(NEW_PASSWORD);
  await here.getByRole('button', { name: 'Ganti kata sandi' }).click();
  await expect(here.getByRole('status')).toContainText('Kata sandi sudah diganti');

  await there.goto('/akun');
  await expect(there).toHaveURL(/\/masuk/);
  await here.reload();
  await expect(here).toHaveURL(/\/akun$/);
  await latestMail(email, 'telah diganti');
});

test('the session list shows this device and can sign out another one', async ({ browser }) => {
  const email = await createVerifiedUser('sesi');
  const here = await signedInContext(browser, email);
  const there = await signedInContext(browser, email);
  await here.reload();

  const sessions = here.getByRole('region', { name: 'Sesi aktif' });
  await expect(sessions.getByText('perangkat ini')).toHaveCount(1);
  await sessions
    .getByRole('button', { name: /^Keluarkan sesi/ })
    .first()
    .click();
  await expect(here).toHaveURL(/\/akun#sesi$/);

  await there.goto('/akun');
  await expect(there).toHaveURL(/\/masuk/);
});

test('sign out, then the account page asks to sign in again', async ({ page }) => {
  const email = await createVerifiedUser('keluar');
  await signIn(page, email);
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect(page).toHaveURL(/\/masuk\?pesan=keluar$/);
  await page.goto('/akun');
  await expect(page).toHaveURL(/\/masuk\?ke=%2Fakun$/);
});

test('delete the account with its password; it cannot sign in afterwards', async ({ page }) => {
  const email = await createVerifiedUser('hapus');
  await signIn(page, email);
  const region = page.getByRole('region', { name: 'Hapus akun' });
  await region.getByLabel('Kata sandi', { exact: true }).fill('bukan kata sandinya');
  await region.getByRole('button', { name: 'Hapus akun saya' }).click();
  await expect(region.getByRole('alert')).toContainText('Akun tidak dihapus');

  await region.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await region.getByRole('button', { name: 'Hapus akun saya' }).click();
  await expect(page).toHaveURL(/\/masuk\?pesan=akun-dihapus$/);
  await latestMail(email, 'telah dihapus');

  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page.locator('main').getByRole('alert')).toHaveText('Email atau kata sandi salah.');
});

test('show-password buttons reveal what was typed, on every password field', async ({ page }) => {
  await page.goto('/daftar');
  const field = page.getByLabel('Kata sandi', { exact: true });
  await field.fill(PASSWORD);
  const toggles = page.getByRole('button', { name: 'Tampilkan kata sandi' });
  await expect(toggles).toHaveCount(2);
  await toggles.first().click();
  await expect(field).toHaveAttribute('type', 'text');
  await expect(field).toHaveValue(PASSWORD);
  await page.getByRole('button', { name: 'Sembunyikan kata sandi' }).click();
  await expect(field).toHaveAttribute('type', 'password');
  for (const path of ['/masuk', '/atur-ulang-sandi?t=' + 'a'.repeat(43)]) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Tampilkan kata sandi' }).first()).toBeVisible();
  }
});

test('register refuses a repeated password that differs, and keeps the e-mail', async ({
  page,
}) => {
  const email = newEmail('beda');
  await page.goto('/daftar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Ulangi kata sandi').fill(PASSWORD + ' x');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page.getByText('Kedua kata sandi tidak sama.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue(email);
  await expect(page.getByLabel('Kata sandi', { exact: true })).toHaveValue('');
});

test('a phone number given at sign-up shows masked on the account page, and can be changed and removed', async ({
  page,
}) => {
  const email = newEmail('hp');
  await page.goto('/daftar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Ulangi kata sandi').fill(PASSWORD);
  await page.getByLabel('Nomor HP (opsional)').fill('0812-3456-7890');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page.getByRole('status')).toContainText('Cek kotak masuk email Anda');

  await signIn(page, email);
  const section = page.getByRole('region', { name: 'Nomor HP' });
  await expect(section.getByText('+62 812 •••• 7890')).toBeVisible();
  await expect(page.getByText('81234567890')).toHaveCount(0);
  await section.getByLabel('Nomor HP baru').fill('abc');
  await section.getByRole('button', { name: 'Simpan nomor HP' }).click();
  await expect(section.getByRole('alert')).toContainText('nomor HP Indonesia');
  await section.getByLabel('Nomor HP baru').fill('+62 857 9999 1234');
  await section.getByRole('button', { name: 'Simpan nomor HP' }).click();
  await expect(section.getByRole('status')).toContainText('Nomor HP sudah disimpan');
  await page.reload();
  await expect(section.getByText('+62 857 •••• 1234')).toBeVisible();
  await section.getByRole('button', { name: 'Hapus nomor HP' }).click();
  await expect(section.getByRole('status')).toContainText('Nomor HP sudah dihapus');
  await page.reload();
  await expect(section.getByText('Belum ada nomor HP.')).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('register, sign in and sign out still work (plain forms)', async ({ page }) => {
    const email = newEmail('nojs');
    await page.goto('/daftar');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Ulangi kata sandi').fill(PASSWORD);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Buat akun' }).click();
    await expect(page.getByRole('status')).toContainText('Cek kotak masuk email Anda');

    // No dead controls: the show-password button needs JavaScript, so it is not rendered.
    await page.goto('/masuk');
    await expect(page.getByRole('button', { name: 'Tampilkan kata sandi' })).toHaveCount(0);
    await signIn(page, email);
    await expect(page.getByText('Belum terverifikasi')).toBeVisible();
    await page.getByRole('button', { name: 'Keluar' }).click();
    await expect(page).toHaveURL(/\/masuk\?pesan=keluar$/);
  });
});
