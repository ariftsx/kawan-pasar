import 'server-only';
import { TokenSchema } from '@kawan-pasar/contracts/auth';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { adminApi, authApi } from '../auth/api';
import { SESSION_COOKIE } from '../auth/cookie';
import { accountHrefs } from '../hrefs';

export interface AdminContext {
  token: string;
  csrf: string;
  /** Until when changes are allowed without entering the password again (null: ask). */
  confirmedUntil: string | null;
}

/**
 * The admin's session for the admin pages (Fase 3B), loaded once per request. Not an admin (or
 * no longer one): 404, so the admin area is not even announced. Session gone: sign in again.
 */
export const adminContext = cache(async (): Promise<AdminContext> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  if (!TokenSchema.safeParse(token).success) redirect(accountHrefs.signIn('/admin'));
  const [status, me] = await Promise.all([adminApi.status(token), authApi.me(token)]);
  if (!status.ok) {
    if (status.code === 'unauthenticated') redirect(accountHrefs.notice('sesi-berakhir'));
    if (status.code === 'forbidden') notFound();
    throw new Error('admin status unavailable');
  }
  if (!me.ok) redirect(accountHrefs.notice('sesi-berakhir'));
  return { token, csrf: me.data.csrf, confirmedUntil: status.data.confirmedUntil };
});
