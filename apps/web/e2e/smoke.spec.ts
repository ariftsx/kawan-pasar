import { expect, test } from '@playwright/test';

test('health check answers without caching', async ({ request }) => {
  const response = await request.get('/api/healthz');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok' });
  expect(response.headers()['cache-control']).toBe('no-store');
});

test('home page carries a per-request CSP nonce on every script', async ({ request }) => {
  const [first, second] = await Promise.all([request.get('/'), request.get('/')]);
  const csp = first.headers()['content-security-policy'] ?? '';
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];

  expect(first.status()).toBe(200);
  expect(nonce).toBeDefined();
  expect(second.headers()['content-security-policy']).not.toBe(csp);

  const html = await first.text();
  const scriptTags = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scriptTags.length).toBeGreaterThan(0);
  for (const tag of scriptTags) {
    expect(tag).toContain(`nonce="${String(nonce)}"`);
  }
});

test('home page sends the security headers from docs 15 §10', async ({ request }) => {
  const headers = (await request.get('/')).headers();

  expect(headers['strict-transport-security']).toContain('max-age=63072000');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['cross-origin-opener-policy']).toBe('same-origin');
  expect(headers['x-powered-by']).toBeUndefined();
});

test('home page renders the DATA DEMO cost card', async ({ request }) => {
  const html = await (await request.get('/')).text();

  expect(html).toContain('DATA DEMO');
  expect(html).toContain('10.850');
  expect(html).toContain('10.914');
});
