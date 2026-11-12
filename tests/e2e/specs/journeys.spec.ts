import { expect, test } from '@playwright/test';

/** End-user journeys through Traefik (v0.4 prototype links and flows). */
for (const width of [360, 1280] as const) {
  test.describe(`${String(width)} px`, () => {
    test.use({ viewport: { width, height: 860 } });

    test('first visit → orientation → Beranda; the next visit to / goes straight to Beranda', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Berapa harga cabai');
      await page.getByRole('link', { name: /Lihat harga hari ini/ }).click();
      await expect(page).toHaveURL(/\/beranda$/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Cek harga dulu');
      await page.goto('/');
      await expect(page).toHaveURL(/\/beranda$/);
    });

    test('Beranda → commodity → forecast → change horizon and commodity', async ({ page }) => {
      await page.goto('/beranda');
      await page.getByRole('link', { name: 'Cabai merah keriting' }).first().click();
      await expect(page).toHaveURL(/\/harga\/cabai-merah-keriting$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cabai merah keriting');
      await page.getByRole('link', { name: 'Lihat prediksi' }).click();
      await expect(page).toHaveURL(/\/prediksi\/cabai-merah-keriting$/);

      const panel = page.locator('#prediksi-panel');
      await expect(panel).toHaveAttribute('data-active-horizon', '7');
      await page
        .getByRole('group', { name: 'Horizon prediksi' })
        .getByRole('button', { name: /^30H/ })
        .click();
      await expect(panel).toHaveAttribute('data-active-horizon', '30');
      await expect(panel.locator('div[data-horizon-only="30"]')).toBeVisible();
      await expect(panel.locator('div[data-horizon-only="7"]')).toBeHidden();

      await page.getByRole('link', { name: 'Bawang merah' }).click();
      await expect(page).toHaveURL(/\/prediksi\/bawang-merah$/);
      await expect(
        page.getByRole('heading', { name: /Grafik prediksi · Bawang merah/ }),
      ).toBeVisible();
    });

    test('price chart ranges switch the visible chart', async ({ page }) => {
      await page.goto('/harga/cabai-merah-keriting');
      const chart = page.locator('#detail-riwayat');
      await expect(chart.locator('[data-range="90d"]')).toBeVisible();
      await page
        .getByRole('group', { name: 'Rentang waktu grafik' })
        .getByRole('button', { name: /^1T/ })
        .click();
      await expect(chart.locator('[data-range="365d"]')).toBeVisible();
      await expect(chart.locator('[data-range="90d"]')).toBeHidden();
    });

    test('Edukasi → article → back to all topics', async ({ page }) => {
      await page.goto('/edukasi');
      await page
        .getByRole('link', { name: /Apa itu inflasi pangan/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\/edukasi\/apa-itu-inflasi-pangan$/);
      await expect(page.getByRole('navigation', { name: 'Di halaman ini' })).toBeVisible();
      await page.getByRole('link', { name: 'Semua topik edukasi' }).click();
      await expect(page).toHaveURL(/\/edukasi$/);
    });

    test('ARIF-Net → limitations', async ({ page }) => {
      await page.goto(width < 1024 ? '/lainnya' : '/beranda');
      if (width < 1024) {
        await page.getByRole('link', { name: /Kenalan dengan ARIF-Net/ }).click();
      } else {
        await page
          .getByRole('navigation', { name: 'Navigasi utama' })
          .getByRole('link', { name: 'ARIF-Net' })
          .click();
      }
      await expect(page).toHaveURL(/\/arif-net$/);
      await page.getByRole('link', { name: /Baca keterbatasan/ }).click();
      await expect(page).toHaveURL(/\/arif-net\/keterbatasan$/, { timeout: 15_000 });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Jujur soal batasannya');
    });

    test('unknown commodity, article and market answer with the not-found page', async ({
      page,
    }) => {
      // Refused by proxy.ts before any render: never cached (a cached 404 would mean a random
      // path created an ISR entry).
      for (const path of ['/harga/kopi', '/prediksi/kopi', '/edukasi/Bad_Slug', '/ZZZZ/harga']) {
        const res = await page.goto(path);
        expect(res?.status(), path).toBe(404);
        expect(res?.headers()['cache-control'], path).toContain('no-store');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Halaman tidak ditemukan');
      }
      // A well-formed but unknown slug is answered by the page (checked against the article list).
      const res = await page.goto('/edukasi/tidak-ada');
      expect(res?.status()).toBe(404);
    });
  });
}
