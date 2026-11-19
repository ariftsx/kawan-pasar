import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { dataRewrites } from './lib/routes';
import { config, proxy } from './proxy';

const run = (path: string, onboarded?: string) => {
  const request = new NextRequest(`http://web:3000${path}`);
  // Set through the cookie API: test DOMs drop the forbidden Cookie request header.
  if (onboarded !== undefined) request.cookies.set('kp_onboarded', onboarded);
  return proxy(request);
};

const passes = (path: string): boolean => run(path).headers.get('x-middleware-next') === '1';

/** Rewrites to the static not-found page (real 404 status, no render work). */
const isNotFound = (path: string): boolean => {
  const res = run(path);
  return (
    res.status === 404 &&
    (res.headers.get('x-middleware-rewrite') ?? '').includes('/_kp/tidak-ditemukan')
  );
};

/** Minimal matcher → RegExp for the patterns used in `config.matcher`. */
function matcherRegExp(pattern: string): RegExp {
  const body = pattern.replace(/\/:[a-z]+\*/g, '(?:/.*)?').replace(/:[a-z]+/g, '[^/]+');
  return new RegExp(`^${body}$`);
}

describe('proxy: market-scoped data routes', () => {
  it('lets known markets, commodities and slugs through', () => {
    expect(passes('/PIKJ/beranda')).toBe(true);
    expect(passes('/PIKJ/harga')).toBe(true);
    expect(passes('/PIKJ/harga/bawang-merah')).toBe(true);
    expect(passes('/PIKJ/prediksi/cabai-merah-keriting')).toBe(true);
    expect(passes('/PIKJ/edukasi/apa-itu-inflasi-pangan')).toBe(true);
    expect(passes('/PIKJ/pasar')).toBe(true);
  });

  it('answers unknown markets, commodities, slugs and extra segments with the not-found page', () => {
    expect(isNotFound('/ZZZZ/harga')).toBe(true);
    expect(isNotFound('/pikj/harga')).toBe(true);
    expect(isNotFound('/PIKJ/harga/kopi')).toBe(true);
    expect(isNotFound('/PIKJ/prediksi/kopi')).toBe(true);
    expect(isNotFound('/PIKJ/edukasi/Bad_Slug')).toBe(true);
    expect(isNotFound('/PIKJ/edukasi/..%2Fetc')).toBe(true);
    expect(isNotFound('/PIKJ/harga/bawang-merah/extra')).toBe(true);
    expect(isNotFound('/PIKJ/pasar/x')).toBe(true);
  });

  it('never caches the refusal', () => {
    expect(run('/ZZZZ/harga').headers.get('cache-control')).toContain('no-store');
  });
});

describe('proxy: first-visit orientation', () => {
  it('sends returning visitors from / to /beranda', () => {
    const res = run('/', '1');
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/beranda');
  });

  it('shows the orientation page on a first visit', () => {
    expect(passes('/')).toBe(true);
    expect(run('/', '0').status).toBe(200);
  });
});

describe('rewrites and matcher stay in sync', () => {
  // The proxy runs on the URL as requested, i.e. BEFORE rewrites: the public source paths are
  // the ones that must be guarded (checking only rewrite destinations missed this).
  const matchers = config.matcher.map(matcherRegExp);
  const samples: Record<string, string> = {
    ':commodity': 'bawang-merah',
    ':slug': 'apa-itu-inflasi-pangan',
  };

  it('guards every public data URL and its internal form', () => {
    for (const r of dataRewrites('PIKJ')) {
      for (const path of [r.source, r.destination]) {
        const sample = path.replace(/:[a-z]+/g, (p) => samples[p] ?? 'x');
        expect(
          matchers.some((m) => m.test(sample)),
          sample,
        ).toBe(true);
        expect(passes(sample), sample).toBe(true);
      }
    }
  });

  it('refuses unknown commodities, slugs and extra segments on public URLs', () => {
    expect(isNotFound('/harga/kopi')).toBe(true);
    expect(isNotFound('/prediksi/kopi')).toBe(true);
    expect(isNotFound('/edukasi/Bad_Slug')).toBe(true);
    expect(isNotFound('/harga/bawang-merah/extra')).toBe(true);
    expect(isNotFound('/beranda/x')).toBe(true);
    expect(isNotFound('/pasar/x')).toBe(true);
  });
});

describe('proxy: account pages (ADR 0011)', () => {
  const account = (path: string, session?: string) => {
    const request = new NextRequest(`http://web:3000${path}`);
    if (session !== undefined) request.cookies.set('__Host-kp_session', session);
    return proxy(request);
  };
  const scriptSrc = (csp: string | null): string =>
    (csp ?? '').split(';').find((d) => d.trim().startsWith('script-src')) ?? '';

  it('sends visitors without a session from /akun to sign-in, coming back afterwards', () => {
    const res = account('/akun');
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://web:3000/masuk?ke=%2Fakun');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
  });

  it('the alerts page also needs a session; the unsubscribe link page does not', () => {
    const alerts = account('/peringatan');
    expect(alerts.status).toBe(307);
    expect(alerts.headers.get('location')).toBe('http://web:3000/masuk?ke=%2Fperingatan');
    expect(account('/berhenti-ringkasan').headers.get('x-middleware-next')).toBe('1');
  });

  it('renders account pages with a per-request nonce CSP, never cached', () => {
    for (const path of [
      '/akun',
      '/masuk',
      '/daftar',
      '/lupa-sandi',
      '/atur-ulang-sandi',
      '/verifikasi-email',
      '/peringatan',
      '/berhenti-ringkasan',
    ]) {
      const res = account(path, 's'.repeat(43));
      expect(res.headers.get('x-middleware-next'), path).toBe('1');
      expect(res.headers.get('cache-control'), path).toBe('private, no-store');
      const src = scriptSrc(res.headers.get('content-security-policy'));
      expect(src, path).toMatch(/'nonce-[A-Za-z0-9+/=]{22,}' 'strict-dynamic'/);
      expect(src, path).not.toContain('unsafe-inline');
      // Next reads the nonce from the request CSP header it forwards.
      expect(res.headers.get('x-middleware-request-content-security-policy'), path).toContain(
        "'strict-dynamic'",
      );
    }
  });

  it('uses a fresh nonce for every request', () => {
    const a = scriptSrc(account('/masuk').headers.get('content-security-policy'));
    const b = scriptSrc(account('/masuk').headers.get('content-security-policy'));
    expect(a).not.toBe(b);
  });

  it('keeps tokens in links out of the Referer header', () => {
    expect(account('/atur-ulang-sandi').headers.get('referrer-policy')).toBe('no-referrer');
    expect(account('/verifikasi-email').headers.get('referrer-policy')).toBe('no-referrer');
    expect(account('/berhenti-ringkasan').headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('covers every account page in the matcher', () => {
    const matchers = config.matcher.map(matcherRegExp);
    for (const path of [
      '/akun',
      '/akun/sesi',
      '/masuk',
      '/daftar',
      '/lupa-sandi',
      '/atur-ulang-sandi',
      '/verifikasi-email',
      '/peringatan',
      '/berhenti-ringkasan',
    ]) {
      expect(
        matchers.some((m) => m.test(path)),
        path,
      ).toBe(true);
    }
  });
});
