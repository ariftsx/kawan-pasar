import 'server-only';
import { TokenSchema } from '@kawan-pasar/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthFailure } from './api';
import { SESSION_COOKIE, expiredSessionCookie } from './cookie';
import type { FormState } from './form-state';
import { failureMessage } from './messages';
import { accountHrefs } from '../hrefs';

// Shared by the account and alert Server Actions (a 'use server' module may only export
// actions, so the helpers live here).

export const text = (form: FormData, name: string): string => {
  const v = form.get(name);
  return typeof v === 'string' ? v : '';
};

export function failed(failure: AuthFailure, values?: FormState['values']): FormState {
  const state: FormState = { status: 'error', message: failureMessage(failure) };
  if (failure.code === 'weak_password') {
    const field = failure.fields?.[0] ?? 'password';
    state.fields = { [field]: failureMessage(failure) };
  }
  return values === undefined ? state : { ...state, values };
}

export async function sessionToken(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value !== undefined && TokenSchema.safeParse(value).success ? value : null;
}

/** Session-bound actions: no cookie, or a session the API no longer knows, → sign in again. */
export async function withSession(
  run: (session: string) => Promise<FormState | null>,
  back?: string,
): Promise<FormState> {
  const session = await sessionToken();
  if (session === null) redirect(accountHrefs.signIn(back));
  const result = await run(session);
  return result ?? { status: 'done' };
}

export async function endSession(): Promise<never> {
  (await cookies()).set(expiredSessionCookie());
  redirect(accountHrefs.signIn());
}
