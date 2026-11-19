import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, createVerifiedUser, resetAccountRateLimits } from './support/accounts.js';
import { backdateWatches, pricesChanged } from './support/alerts.js';

// End-user journeys of Fase 2B (alerts), through Traefik like a real visitor.
// Each journey registers, verifies and signs in (Argon2, two at a time): allow for that.
test.describe.configure({ timeout: 90_000 });

test.beforeEach(() => {
  resetAccountRateLimits();
});

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/masuk?ke=%2Fperingatan');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  // Argon2 runs at most two at a time (HashGate); parallel tests sign in at once.
  await expect(page).toHaveURL(/\/peringatan$/, { timeout: 20_000 });
}

test('the alerts page needs a session and comes back after sign-in', async ({ page }) => {
  await page.goto('/peringatan');
  await expect(page).toHaveURL(/\/masuk\?ke=%2Fperingatan$/);
});

for (const width of [360, 1280] as const) {
  test.describe(`${String(width)} px`, () => {
    test.use({ viewport: { width, height: 900 } });

    test('empty state, then watch a commodity with an own limit and save the switches', async ({
      page,
    }) => {
      await signIn(page, await createVerifiedUser(`pantau${String(width)}`));
      await expect(page.getByRole('heading', { name: 'Belum ada kabar harga' })).toBeVisible();
      const watches = page.getByRole('region', { name: 'Komoditas yang dipantau' });
      await watches.getByLabel('Komoditas').selectOption('bawang-merah');
      await watches.getByLabel('Arah').selectOption('above');
      await watches.getByLabel('Batas harga (Rp/kg, opsional)').fill('39.000');
      await watches.getByRole('button', { name: 'Pantau komoditas' }).click();
      // Each change reloads the page (post/redirect/get): wait for it before the next action.
      await expect(page).toHaveURL(/disimpan=pantauan/, { timeout: 15_000 });
      await expect(page.getByRole('status')).toContainText('Daftar pantauan sudah diperbarui');
      await expect(watches.getByText('Di atas Rp 39.000/kg')).toBeVisible();

      const settings = page.getByRole('region', { name: 'Pengaturan peringatan' });
      await settings.getByLabel(/Ringkasan mingguan/).check();
      await settings.getByRole('button', { name: 'Simpan pengaturan' }).click();
      await expect(page).toHaveURL(/disimpan=pengaturan/, { timeout: 15_000 });
      await expect(page.getByRole('status')).toContainText('Pengaturan peringatan sudah disimpan');
      await expect(settings.getByLabel(/Ringkasan mingguan/)).toBeChecked();

      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow).toBe(false);
    });
  });
}

test('a crossed own limit arrives as news after a price import; mark all read', async ({
  page,
}) => {
  const email = await createVerifiedUser('kabar');
  await signIn(page, email);
  const watches = page.getByRole('region', { name: 'Komoditas yang dipantau' });
  await watches.getByLabel('Komoditas').selectOption('bawang-merah');
  await watches.getByLabel('Batas harga (Rp/kg, opsional)').fill('39.000');
  await watches.getByRole('button', { name: 'Pantau komoditas' }).click();
  await expect(page).toHaveURL(/disimpan=pantauan/, { timeout: 15_000 });
  await expect(watches.getByText('Di atas Rp 39.000/kg')).toBeVisible();

  backdateWatches(email);
  await pricesChanged();
  // The worker evaluates in the background: reload until the news is there.
  await expect
    .poll(
      async () => {
        await page.goto('/peringatan');
        return page.getByText('Bawang merah di atas batas Anda (Rp 39.000/kg)').count();
      },
      { timeout: 20_000, intervals: [500, 1_000, 2_000] },
    )
    .toBe(1);
  await expect(page.getByText('Rp 40.300/kg di Pasar Kramat Jati pada 30 Sep 2026')).toBeVisible();
  await expect(page.getByRole('link', { name: /Belum dibaca \([1-9]\d*\)/ })).toBeVisible();

  // The same data again: no second copy of the news.
  await pricesChanged();
  await page.waitForTimeout(3_000);
  await page.goto('/peringatan');
  await expect(page.getByText('Bawang merah di atas batas Anda (Rp 39.000/kg)')).toHaveCount(1);

  await page.getByRole('button', { name: 'Tandai semua dibaca' }).click();
  await expect(page).toHaveURL(/tab=all/, { timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Belum dibaca (0)' })).toBeVisible();
  await page.getByRole('link', { name: 'Lihat detail' }).first().click();
  await expect(page).toHaveURL(/\/harga\/bawang-merah$/);
});

test('without JavaScript, watching and saving still work (plain forms)', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await signIn(page, await createVerifiedUser('nojs-pantau'));
  const watches = page.getByRole('region', { name: 'Komoditas yang dipantau' });
  await watches.getByLabel('Komoditas').selectOption('cabai-merah-keriting');
  await watches.getByRole('button', { name: 'Pantau komoditas' }).click();
  await expect(page).toHaveURL(/disimpan=pantauan/, { timeout: 15_000 });
  await expect(watches.getByText('Cabai merah keriting')).toBeVisible();
  await expect(watches.getByText('Tanpa batas harga')).toBeVisible();
  await context.close();
});

test('the alerts page is private and under the nonce CSP', async ({ page }) => {
  await signIn(page, await createVerifiedUser('csp-pantau'));
  const res = await page.goto('/peringatan');
  expect(res?.headers()['cache-control']).toBe('private, no-store');
  expect(res?.headers()['content-security-policy']).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
});
