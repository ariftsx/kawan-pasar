/**
 * Session cookie (ADR 0011): `__Host-` prefix, so the browser only accepts it with Secure, Path=/
 * and no Domain. HttpOnly keeps it from scripts; SameSite=Lax keeps it off cross-site posts.
 * Its value is the opaque token; the API stores only its SHA-256.
 */
export const SESSION_COOKIE = '__Host-kp_session';

export interface SessionCookie {
  name: typeof SESSION_COOKIE;
  value: string;
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  path: '/';
  expires: Date;
}

export function sessionCookie(token: string, expires: Date): SessionCookie {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    expires,
  };
}

/**
 * Removes the session cookie. A bare delete (`Set-Cookie: name=; Expires=…` without Secure) is
 * ignored by browsers for a __Host- cookie, so the same attributes are repeated, expired.
 */
export function expiredSessionCookie(): SessionCookie {
  return sessionCookie('', new Date(0));
}
