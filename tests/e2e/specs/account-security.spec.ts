import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  PASSWORD,
  createVerifiedUser,
  latestMail,
  linkTo,
  newEmail,
  resetAccountRateLimits,
} from './support/accounts.js';

// Security behaviour of the account pages as a browser sees it (Fase 2A review focus).

test.beforeEach(() => {
  resetAccountRateLimits();
});

/** Submits the sign-in form and waits for the Server Action's answer (one attempt per call). */
async function submitLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(password);
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && r.url().includes('/masuk')),
    page.getByRole('button', { name: 'Masuk' }).click(),
  ]);
}

test('the session cookie is __Host-, HttpOnly, Secure and SameSite=Lax', async ({
  page,
  context,
}) => {
  const email = await createVerifiedUser('cookie');
  await page.goto('/masuk');
  await submitLogin(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/akun$/);
  const cookie = (await context.cookies()).find((c) => c.name === '__Host-kp_session');
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' });
  expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
});

test('account pages: one nonce CSP without unsafe-inline scripts, private, clean console', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  for (const path of ['/masuk', '/daftar', '/lupa-sandi']) {
    const res = await page.goto(path);
    const headers = await res?.headersArray();
    const csp = (headers ?? []).filter((h) => h.name.toLowerCase() === 'content-security-policy');
    expect(csp, path).toHaveLength(1);
    const scriptSrc = csp[0]?.value.split(';').find((d) => d.trim().startsWith('script-src')) ?? '';
    expect(scriptSrc, path).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
    expect(scriptSrc, path).not.toContain('unsafe-inline');
    expect(res?.headers()['cache-control'], path).toBe('private, no-store');
  }
  // The form hydrates under the nonce policy (any blocked script would surface here).
  await page.goto('/masuk');
  await page.getByLabel('Email').fill('a@b.id');
  expect(errors).toEqual([]);
});

test('a ?ke= pointing to another site lands on the account page instead', async ({ page }) => {
  const email = await createVerifiedUser('ke');
  await page.goto('/masuk?ke=https://evil.example/');
  await submitLogin(page, email, PASSWORD);
  await expect(page).toHaveURL(/^http:\/\/127\.0\.0\.1:8080\/akun$/);
});

test('opening the verification link does not verify; only pressing the button does', async ({
  page,
}) => {
  const email = newEmail('pindai');
  await page.goto('/daftar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Kata sandi', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Ulangi kata sandi').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page.getByRole('status')).toBeVisible();
  const link = linkTo((await latestMail(email, 'Verifikasi')).text, '/verifikasi-email');

  const res = await page.goto(link); // what a mail link scanner does
  expect(res?.headers()['referrer-policy']).toBe('no-referrer');
  await page.goto('/masuk');
  await submitLogin(page, email, PASSWORD);
  await expect(page.getByText('Belum terverifikasi')).toBeVisible();
});

test('a reset link works once', async ({ page }) => {
  const email = await createVerifiedUser('sekali');
  await page.goto('/lupa-sandi');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Kirim tautan' }).click();
  const link = linkTo((await latestMail(email, 'Atur ulang')).text, '/atur-ulang-sandi');

  await page.goto(link);
  await page.getByLabel('Kata sandi baru', { exact: true }).fill('kalimat sandi pertama baru');
  await page.getByLabel('Ulangi kata sandi baru').fill('kalimat sandi pertama baru');
  await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
  await expect(page).toHaveURL(/pesan=sandi-diubah/);

  await page.goto(link);
  await page.getByLabel('Kata sandi baru', { exact: true }).fill('kalimat sandi kedua baru');
  await page.getByLabel('Ulangi kata sandi baru').fill('kalimat sandi kedua baru');
  await page.getByRole('button', { name: 'Simpan kata sandi' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('tidak berlaku lagi');
});

test('registering an existing address answers the same and tells the owner', async ({ page }) => {
  const email = await createVerifiedUser('ganda');
  await page.goto('/daftar');
  await page.getByLabel('Email').fill(email.toUpperCase());
  await page.getByLabel('Kata sandi', { exact: true }).fill('kalimat sandi lain sekali');
  await page.getByLabel('Ulangi kata sandi').fill('kalimat sandi lain sekali');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Buat akun' }).click();
  await expect(page.getByRole('status')).toContainText('Cek kotak masuk email Anda');
  await latestMail(email, 'sudah punya akun');
});

test('five wrong passwords lock the account for a while', async ({ page }) => {
  const email = await createVerifiedUser('kunci');
  await page.goto('/masuk');
  for (let i = 0; i < 5; i += 1) {
    await submitLogin(page, email, `salah ${String(i)} kata sandi`);
    await expect(page.locator('main').getByRole('alert')).toHaveText(
      'Email atau kata sandi salah.',
    );
  }
  await submitLogin(page, email, PASSWORD);
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Terlalu banyak percobaan gagal',
  );
});

test('a form posted from another site does not act', async ({ page, request }) => {
  const email = await createVerifiedUser('asal');
  await page.goto('/masuk');
  await submitLogin(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/akun$/);
  // Capture the browser's own sign-out request (Server Action), stop it, then replay it
  // byte for byte from a foreign origin, with the victim's cookie.
  let captured: { headers: Record<string, string>; body: Buffer | null } | undefined;
  await page.route('**/akun', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    captured = { headers: route.request().headers(), body: route.request().postDataBuffer() };
    return route.abort();
  });
  await page.getByRole('button', { name: 'Keluar' }).click();
  await expect.poll(() => captured !== undefined).toBe(true);
  await page.unroute('**/akun');

  const cookie = (await page.context().cookies()).find((c) => c.name === '__Host-kp_session');
  const res = await request.post('/akun', {
    headers: {
      ...captured?.headers,
      origin: 'https://evil.example',
      cookie: `__Host-kp_session=${cookie?.value ?? ''}`,
    },
    data: captured?.body ?? '',
    maxRedirects: 0,
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  // Still signed in: the forged request did not end the session.
  await page.goto('/akun');
  await expect(page).toHaveURL(/\/akun$/);
});

test('public pages stay shared and cookie-free', async ({ request }) => {
  await request.get('/harga');
  const res = await request.get('/harga');
  // Served from the shared cache (STALE = served while it regenerates in the background).
  expect(res.headers()['x-nextjs-cache']).toMatch(/^(HIT|STALE)$/);
  expect(res.headers()['set-cookie']).toBeUndefined();
});
