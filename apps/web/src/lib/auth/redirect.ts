/** Where a signed-in user lands when `?ke=` is missing or unsafe. */
export const ACCOUNT_HOME = '/akun';

/** Account entry pages: never a destination after signing in (no loops). */
export const AUTH_PAGES = [
  '/masuk',
  '/daftar',
  '/lupa-sandi',
  '/atur-ulang-sandi',
  '/verifikasi-email',
] as const;

const ORIGIN = 'http://kawanpasar.invalid';

/**
 * The `?ke=` target after signing in, only if it stays on this site (open-redirect guard):
 * a single leading slash, no backslash, no control characters, same origin once parsed,
 * not an account entry page, at most 512 characters.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return ACCOUNT_HOME;
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) {
    return ACCOUNT_HOME;
  }
  let url: URL;
  try {
    url = new URL(value, ORIGIN);
  } catch {
    return ACCOUNT_HOME;
  }
  if (url.origin !== ORIGIN || url.pathname.startsWith('//')) return ACCOUNT_HOME;
  if (/%2f|%5c/i.test(value)) return ACCOUNT_HOME;
  if ((AUTH_PAGES as readonly string[]).includes(url.pathname)) return ACCOUNT_HOME;
  return `${url.pathname}${url.search}`;
}
