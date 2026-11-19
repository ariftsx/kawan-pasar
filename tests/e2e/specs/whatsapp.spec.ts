import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, createVerifiedUser, resetAccountRateLimits } from './support/accounts.js';
import { backdateWatches, newPhone, pricesChanged, waMessage, waReply } from './support/alerts.js';

// End-user journey of Fase 2C (WhatsApp, local mock adapter): messages arrive in Mailpit.
test.describe.configure({ timeout: 120_000 });

test.beforeEach(() => {
  resetAccountRateLimits();
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/masuk?ke=%2Fperingatan');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/peringatan$/, { timeout: 20_000 });
}

async function connectWhatsApp(page: Page, phone: string): Promise<void> {
  const wa = page.getByRole('region', { name: 'WhatsApp' });
  await wa.getByRole('button', { name: 'Kirim kode verifikasi' }).click();
  await expect(page).toHaveURL(/wa=kode-terkirim/, { timeout: 15_000 });
  const text = await waMessage(phone, 'Kode verifikasi WhatsApp');
  const code = /(\d{6})/.exec(text)?.[1] ?? '';
  await wa.getByLabel('Kode dari WhatsApp').fill(code);
  await wa.getByRole('button', { name: 'Verifikasi' }).click();
  await expect(page).toHaveURL(/wa=terhubung/, { timeout: 15_000 });
  await expect(wa.getByRole('heading', { name: 'Peringatan WhatsApp aktif!' })).toBeVisible();
}

for (const width of [360, 1280] as const) {
  test(`connect WhatsApp with the code from the phone (${String(width)} px)`, async ({
    browser,
  }) => {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    const phone = newPhone();
    await signIn(page, await createVerifiedUser(`wa${String(width)}`, phone));
    const wa = page.getByRole('region', { name: 'WhatsApp' });
    await expect(wa.getByText('Belum terhubung.')).toBeVisible();
    await connectWhatsApp(page, phone);
    await expect(wa.getByText(/Terhubung\./)).toBeVisible();
    const settings = page.getByRole('region', { name: 'Pengaturan peringatan' });
    await expect(settings.getByLabel(/WhatsApp/)).toBeChecked();

    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
  });
}

test('a wrong code is refused with a clear message', async ({ page }) => {
  const phone = newPhone();
  await signIn(page, await createVerifiedUser('wa-salah', phone));
  const wa = page.getByRole('region', { name: 'WhatsApp' });
  await wa.getByRole('button', { name: 'Kirim kode verifikasi' }).click();
  await expect(page).toHaveURL(/wa=kode-terkirim/, { timeout: 15_000 });
  const code = /(\d{6})/.exec(await waMessage(phone, 'Kode verifikasi'))?.[1] ?? '000000';
  await wa.getByLabel('Kode dari WhatsApp').fill(code === '000000' ? '111111' : '000000');
  await wa.getByRole('button', { name: 'Verifikasi' }).click();
  await expect(wa.getByRole('alert').first()).toContainText('Kode salah');
});

test('news goes to WhatsApp too, and replying STOP stops it', async ({ page }) => {
  const phone = newPhone();
  const email = await createVerifiedUser('wa-kabar', phone);
  await signIn(page, email);
  await connectWhatsApp(page, phone);

  const watches = page.getByRole('region', { name: 'Komoditas yang dipantau' });
  await watches.getByLabel('Komoditas').selectOption('bawang-merah');
  await watches.getByLabel('Batas harga (Rp/kg, opsional)').fill('39.000');
  await watches.getByRole('button', { name: 'Pantau komoditas' }).click();
  await expect(page).toHaveURL(/disimpan=pantauan/, { timeout: 15_000 });
  backdateWatches(email);
  await pricesChanged();

  const text = await waMessage(phone, 'Bawang merah di atas batas Anda');
  expect(text).toMatch(/^Kawan Pasar 🌶️/);
  expect(text).toContain('Lihat detail → ');
  expect(text).toContain('Balas STOP untuk berhenti.');
  await expect
    .poll(
      async () => {
        await page.goto('/peringatan');
        return page.getByText(/juga dikirim ke WhatsApp/).count();
      },
      { timeout: 20_000, intervals: [500, 1_000, 2_000] },
    )
    .toBeGreaterThan(0);

  await waReply(phone, 'STOP');
  await waMessage(phone, 'tidak akan menerima pesan WhatsApp');
  await page.goto('/peringatan');
  await expect(
    page.getByRole('region', { name: 'WhatsApp' }).getByText(/Dihentikan lewat balasan STOP/),
  ).toBeVisible();
});
