import { describe, expect, it } from 'vitest';
import { SESSION_COOKIE, expiredSessionCookie, sessionCookie } from './cookie';

describe('session cookie (ADR 0011)', () => {
  it('is a __Host- cookie: Secure, HttpOnly, SameSite=Lax, whole site, no Domain', () => {
    const expires = new Date('2026-12-17T00:00:00Z');
    const c = sessionCookie('t'.repeat(43), expires);
    expect(SESSION_COOKIE).toBe('__Host-kp_session');
    expect(c).toEqual({
      name: '__Host-kp_session',
      value: 't'.repeat(43),
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      expires,
    });
    expect('domain' in c).toBe(false);
  });
});

describe('clearing the session cookie', () => {
  it('repeats Secure and Path=/: browsers ignore a __Host- cookie set without them', () => {
    const c = expiredSessionCookie();
    expect(c).toMatchObject({
      name: '__Host-kp_session',
      value: '',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(c.expires.getTime()).toBe(0);
  });
});
