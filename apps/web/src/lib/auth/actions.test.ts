import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// --- Next.js request APIs, replaced by small recorders ---
const jar = new Map<string, { value: string; options?: unknown }>();
const deleted: string[] = [];
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const c = jar.get(name);
        return c === undefined ? undefined : { name, value: c.value };
      },
      set: (cookie: { name: string; value: string }) => {
        jar.set(cookie.name, { value: cookie.value, options: cookie });
      },
      delete: (name: string) => {
        deleted.push(name);
        jar.delete(name);
      },
    }),
  headers: () =>
    Promise.resolve(
      new Headers({ 'x-forwarded-for': '203.0.113.9', 'user-agent': 'Mozilla/5.0 Chrome/140' }),
    ),
}));
class RedirectSignal extends Error {
  constructor(readonly to: string) {
    super(`redirect ${to}`);
  }
}
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

const fetchMock = vi.fn<typeof fetch>();
const SESSION = 's'.repeat(43);
const CSRF = 'c'.repeat(43);

beforeEach(() => {
  vi.stubEnv('API_INTERNAL_URL', 'http://api:3001');
  vi.stubEnv('SERVICE_TOKEN', 't'.repeat(40));
  vi.stubEnv('WEB_REVALIDATE_TOKEN', 'r'.repeat(40));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  jar.clear();
  deleted.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fetchMock.mockReset();
});

const form = (fields: Record<string, string>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const idle = { status: 'idle' as const };

async function redirectOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof RedirectSignal) return e.to;
    throw e;
  }
  throw new Error('no redirect');
}

describe('loginAction', () => {
  it('checks the form against the contract before calling the API', async () => {
    const { loginAction } = await import('./actions');
    const state = await loginAction(idle, form({ email: 'bukan-email', password: '' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.status).toBe('error');
    expect(Object.keys(state.fields ?? {}).sort()).toEqual(['email', 'password']);
  });

  it('on success stores the session cookie and goes to the safe target', async () => {
    fetchMock.mockResolvedValue(
      json({ token: SESSION, csrf: CSRF, expiresAt: '2026-12-17T00:00:00.000Z' }),
    );
    const { loginAction } = await import('./actions');
    const to = await redirectOf(
      loginAction(
        idle,
        form({ email: 'a@b.id', password: 'kata sandi', ke: 'https://evil.example' }),
      ),
    );
    expect(to).toBe('/akun');
    expect(jar.get('__Host-kp_session')?.value).toBe(SESSION);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const sent = new Headers(init?.headers);
    expect(sent.get('x-forwarded-for')).toBe('203.0.113.9');
    expect(sent.get('x-service-token')).toBe('t'.repeat(40));
    expect(init?.cache).toBe('no-store');
  });

  it('hands the previous session of this browser to the API, which ends it', async () => {
    jar.set('__Host-kp_session', { value: SESSION });
    fetchMock.mockResolvedValue(
      json({ token: 'n'.repeat(43), csrf: CSRF, expiresAt: '2026-12-17T00:00:00.000Z' }),
    );
    const { loginAction } = await import('./actions');
    await redirectOf(loginAction(idle, form({ email: 'a@b.id', password: 'kata sandi' })));
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('x-session-token')).toBe(SESSION);
    expect(jar.get('__Host-kp_session')?.value).toBe('n'.repeat(43));
  });

  it('shows one generic message for wrong credentials and keeps the e-mail, not the password', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'invalid_credentials', message: 'invalid credentials' } }, 401),
    );
    const { loginAction } = await import('./actions');
    const state = await loginAction(idle, form({ email: 'a@b.id', password: 'salah' }));
    expect(state).toEqual({
      status: 'error',
      message: 'Email atau kata sandi salah.',
      values: { email: 'a@b.id' },
    });
  });
});

describe('registerAction', () => {
  it('requires the privacy checkbox and a 12-character password', async () => {
    const { registerAction } = await import('./actions');
    const state = await registerAction(idle, form({ email: 'a@b.id', password: 'pendek' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(Object.keys(state.fields ?? {}).sort()).toEqual(['acceptPrivacy', 'password']);
  });

  it('maps a breached password to a field message', async () => {
    fetchMock.mockResolvedValue(
      json({ error: { code: 'weak_password', message: 'breached', fields: ['password'] } }, 422),
    );
    const { registerAction } = await import('./actions');
    const state = await registerAction(
      idle,
      form({
        email: 'a@b.id',
        password: 'qwertyuiopasdfghjkl',
        passwordConfirm: 'qwertyuiopasdfghjkl',
        acceptPrivacy: 'on',
      }),
    );
    expect(state.fields?.['password']).toMatch(/pernah bocor/);
  });
});

describe('account actions', () => {
  it('send the session and the form CSRF token; an expired session goes back to sign-in', async () => {
    jar.set('__Host-kp_session', { value: SESSION });
    fetchMock.mockResolvedValue(
      json({ error: { code: 'unauthenticated', message: 'sign-in required' } }, 401),
    );
    const { changePasswordAction } = await import('./actions');
    const to = await redirectOf(
      changePasswordAction(
        idle,
        form({
          csrf: CSRF,
          current: 'lama sekali',
          next: 'kalimat sandi baru panjang',
          nextConfirm: 'kalimat sandi baru panjang',
        }),
      ),
    );
    const sent = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(sent.get('x-session-token')).toBe(SESSION);
    expect(sent.get('x-csrf-token')).toBe(CSRF);
    expect(to).toBe('/masuk?ke=%2Fakun');
    // Cleared by an expired cookie with the same attributes (a bare delete lacks Secure).
    expect(jar.get('__Host-kp_session')?.value).toBe('');
    expect(deleted).toEqual([]);
  });

  it('without a session cookie, nothing is sent', async () => {
    const { changePasswordAction } = await import('./actions');
    const to = await redirectOf(
      changePasswordAction(
        idle,
        form({
          csrf: CSRF,
          current: 'lama sekali',
          next: 'kalimat sandi baru panjang',
          nextConfirm: 'kalimat sandi baru panjang',
        }),
      ),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(to).toBe('/masuk?ke=%2Fakun');
  });
});

describe('password confirmation and mobile number (Fase 2B)', () => {
  const sentBody = (): Record<string, unknown> =>
    JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string) as Record<string, unknown>;

  it('register: a confirmation that differs is refused before the API is called', async () => {
    const { registerAction } = await import('./actions');
    const state = await registerAction(
      idle,
      form({
        email: 'a@b.id',
        password: 'kalimat sandi panjang',
        passwordConfirm: 'kalimat sandi panjang!',
        acceptPrivacy: 'on',
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.fields).toEqual({ passwordConfirm: 'Kedua kata sandi tidak sama.' });
  });

  it('register: sends a normalised optional number, never the confirmation', async () => {
    fetchMock.mockResolvedValue(json({ status: 'check_email' }, 202));
    const { registerAction } = await import('./actions');
    const base = {
      email: 'a@b.id',
      password: 'kalimat sandi panjang',
      passwordConfirm: 'kalimat sandi panjang',
      acceptPrivacy: 'on',
    };
    await registerAction(idle, form({ ...base, phone: '0812 3456 7890' }));
    expect(sentBody()).toEqual({
      email: 'a@b.id',
      password: 'kalimat sandi panjang',
      phone: '+6281234567890',
      acceptPrivacy: true,
    });
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(json({ status: 'check_email' }, 202));
    await registerAction(idle, form({ ...base, phone: '   ' }));
    expect(sentBody()).not.toHaveProperty('phone');
  });

  it('register: an invalid number is a field error and is kept in the form', async () => {
    const { registerAction } = await import('./actions');
    const state = await registerAction(
      idle,
      form({
        email: 'a@b.id',
        password: 'kalimat sandi panjang',
        passwordConfirm: 'kalimat sandi panjang',
        phone: '021-555',
        acceptPrivacy: 'on',
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.fields?.['phone']).toMatch(/nomor HP/);
    expect(state.values).toEqual({ email: 'a@b.id', phone: '021-555' });
  });

  it('reset and change: the confirmation must match', async () => {
    const { resetPasswordAction, changePasswordAction } = await import('./actions');
    const reset = await resetPasswordAction(
      idle,
      form({ token: 'a'.repeat(43), password: 'kalimat sandi baru', passwordConfirm: 'lain' }),
    );
    expect(reset.fields).toEqual({ passwordConfirm: 'Kedua kata sandi tidak sama.' });
    jar.set('__Host-kp_session', { value: SESSION });
    const change = await changePasswordAction(
      idle,
      form({ csrf: CSRF, current: 'lama sekali', next: 'kalimat sandi baru', nextConfirm: 'x' }),
    );
    expect(change.fields).toEqual({ nextConfirm: 'Kedua kata sandi tidak sama.' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('setPhoneAction and removePhoneAction send the session and CSRF token', async () => {
    jar.set('__Host-kp_session', { value: SESSION });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { setPhoneAction, removePhoneAction } = await import('./actions');
    const done = await setPhoneAction(idle, form({ csrf: CSRF, phone: '+62 857 9999 1234' }));
    expect(done.status).toBe('done');
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url as URL)).toBe('http://api:3001/v1/me/phone');
    expect(init?.method).toBe('PUT');
    expect(sentBody()).toEqual({ phone: '+6285799991234' });
    expect(new Headers(init?.headers).get('x-csrf-token')).toBe(CSRF);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    expect((await removePhoneAction(idle, form({ csrf: CSRF }))).status).toBe('done');
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('DELETE');
    const bad = await setPhoneAction(idle, form({ csrf: CSRF, phone: 'abc' }));
    expect(bad.fields?.['phone']).toMatch(/nomor HP/);
  });
});
