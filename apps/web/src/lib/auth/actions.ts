'use server';

import {
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  ForgotInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetInputSchema,
  SessionIdSchema,
  TokenSchema,
  VerifyInputSchema,
} from '@kawan-pasar/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthFailure } from './api';
import { authApi } from './api';
import { SESSION_COOKIE, expiredSessionCookie, sessionCookie } from './cookie';
import type { FormState } from './form-state';
import { fieldErrors } from './form-state';
import { PASSWORD_PROBLEM, failureMessage } from './messages';
import { accountHrefs } from '../hrefs';

// Account Server Actions (BFF). Each validates its form with the shared contract first
// (validation one of two; the API validates again), then calls the Core API.
// Next.js checks the Origin of every Server Action; the session cookie is SameSite=Lax; and
// account changes also carry the session's CSRF token from the rendered form.

const text = (form: FormData, name: string): string => {
  const v = form.get(name);
  return typeof v === 'string' ? v : '';
};

const EMAIL_MSG = 'Masukkan alamat email yang valid.';
const FIELD_MESSAGES: Record<string, string> = {
  email: EMAIL_MSG,
  password: PASSWORD_PROBLEM['too_short'] ?? '',
  next: PASSWORD_PROBLEM['too_short'] ?? '',
  current: 'Masukkan kata sandi Anda saat ini.',
  acceptPrivacy: 'Setujui kebijakan privasi untuk membuat akun.',
};

function failed(failure: AuthFailure, values?: FormState['values']): FormState {
  const state: FormState = { status: 'error', message: failureMessage(failure) };
  if (failure.code === 'weak_password') {
    const field = failure.fields?.[0] ?? 'password';
    state.fields = { [field]: failureMessage(failure) };
  }
  return values === undefined ? state : { ...state, values };
}

async function sessionToken(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value !== undefined && TokenSchema.safeParse(value).success ? value : null;
}

/** Session-bound actions: no cookie, or a session the API no longer knows, → sign in again. */
async function withSession(
  run: (session: string) => Promise<FormState | null>,
): Promise<FormState> {
  const session = await sessionToken();
  if (session === null) redirect(accountHrefs.signIn());
  const result = await run(session);
  return result ?? { status: 'done' };
}

async function endSession(): Promise<never> {
  (await cookies()).set(expiredSessionCookie());
  redirect(accountHrefs.signIn());
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const input = LoginInputSchema.safeParse({
    email: text(form, 'email'),
    password: text(form, 'password'),
  });
  if (!input.success) {
    return {
      status: 'error',
      message: 'Periksa kembali isian yang ditandai.',
      fields: fieldErrors(input.error, { ...FIELD_MESSAGES, password: 'Masukkan kata sandi.' }),
      values: { email: text(form, 'email').slice(0, 254) },
    };
  }
  const result = await authApi.login(input.data, (await sessionToken()) ?? undefined);
  if (!result.ok) return failed(result, { email: input.data.email });
  (await cookies()).set(sessionCookie(result.data.token, new Date(result.data.expiresAt)));
  redirect(accountHrefs.afterSignIn(text(form, 'ke')));
}

export async function registerAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = text(form, 'email');
  const input = RegisterInputSchema.safeParse({
    email,
    password: text(form, 'password'),
    acceptPrivacy: form.get('acceptPrivacy') === 'on',
  });
  if (!input.success) {
    return {
      status: 'error',
      message: 'Periksa kembali isian yang ditandai.',
      fields: fieldErrors(input.error, FIELD_MESSAGES),
      values: { email: email.slice(0, 254) },
    };
  }
  const result = await authApi.register(input.data);
  if (!result.ok) return failed(result, { email: input.data.email });
  return {
    status: 'done',
    message:
      'Cek kotak masuk email Anda. Kami mengirim tautan verifikasi (berlaku 24 jam). Bila email ini sudah terdaftar, kami mengirim petunjuk masuk.',
  };
}

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const input = ForgotInputSchema.safeParse({ email: text(form, 'email') });
  if (!input.success) {
    return {
      status: 'error',
      message: EMAIL_MSG,
      fields: { email: EMAIL_MSG },
      values: { email: text(form, 'email').slice(0, 254) },
    };
  }
  const result = await authApi.forgotPassword(input.data);
  if (!result.ok) return failed(result, { email: input.data.email });
  return {
    status: 'done',
    message:
      'Bila email itu terdaftar, tautan untuk mengatur ulang kata sandi sudah kami kirim. Tautan berlaku 30 menit.',
  };
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const input = ResetInputSchema.safeParse({
    token: text(form, 'token'),
    password: text(form, 'password'),
  });
  if (!input.success) {
    const fields = fieldErrors(input.error, FIELD_MESSAGES);
    if ('token' in fields) return failed({ ok: false, code: 'invalid_token' });
    return { status: 'error', message: 'Periksa kembali isian yang ditandai.', fields };
  }
  const result = await authApi.resetPassword(input.data);
  if (!result.ok) return failed(result);
  redirect(accountHrefs.notice('sandi-diubah'));
}

export async function verifyEmailAction(_prev: FormState, form: FormData): Promise<FormState> {
  const input = VerifyInputSchema.safeParse({ token: text(form, 'token') });
  if (!input.success) return failed({ ok: false, code: 'invalid_token' });
  const result = await authApi.verifyEmail(input.data.token);
  if (!result.ok) return failed(result);
  return {
    status: 'done',
    message: 'Email Anda sudah terverifikasi. Peringatan harga bisa diaktifkan dari akun Anda.',
  };
}

export async function resendVerificationAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  return withSession(async (session) => {
    const result = await authApi.resendVerification(session, text(form, 'csrf'));
    if (!result.ok) return result.code === 'unauthenticated' ? endSession() : failed(result);
    return { status: 'done', message: 'Tautan verifikasi baru sudah dikirim ke email Anda.' };
  });
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const input = ChangePasswordInputSchema.safeParse({
      current: text(form, 'current'),
      next: text(form, 'next'),
    });
    if (!input.success) {
      return {
        status: 'error',
        message: 'Periksa kembali isian yang ditandai.',
        fields: fieldErrors(input.error, FIELD_MESSAGES),
      };
    }
    const result = await authApi.changePassword(session, text(form, 'csrf'), input.data);
    if (!result.ok) {
      if (result.code === 'unauthenticated') return endSession();
      if (result.code === 'invalid_credentials') {
        return {
          status: 'error',
          message: 'Kata sandi saat ini salah.',
          fields: { current: 'Kata sandi saat ini salah.' },
        };
      }
      return failed(result);
    }
    return {
      status: 'done',
      message: 'Kata sandi sudah diganti. Sesi di perangkat lain sudah dikeluarkan.',
    };
  });
}

export async function revokeSessionAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const id = SessionIdSchema.safeParse(text(form, 'id'));
    if (!id.success) return { status: 'error', message: 'Sesi tidak ditemukan.' };
    const result = await authApi.revokeSession(session, text(form, 'csrf'), id.data);
    if (!result.ok && result.code === 'unauthenticated') return endSession();
    if (!result.ok && result.code !== 'not_found') return failed(result);
    redirect(accountHrefs.sessions());
  });
}

export async function logoutAction(form: FormData): Promise<void> {
  const session = await sessionToken();
  if (session !== null) await authApi.logout(session, text(form, 'csrf'));
  (await cookies()).set(expiredSessionCookie());
  redirect(accountHrefs.notice('keluar'));
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const input = DeleteAccountInputSchema.safeParse({ password: text(form, 'password') });
    if (!input.success) {
      return {
        status: 'error',
        message: 'Masukkan kata sandi untuk menghapus akun.',
        fields: { password: 'Masukkan kata sandi untuk menghapus akun.' },
      };
    }
    const result = await authApi.deleteAccount(session, text(form, 'csrf'), input.data);
    if (!result.ok) {
      if (result.code === 'unauthenticated') return endSession();
      if (result.code === 'invalid_credentials') {
        return {
          status: 'error',
          message: 'Kata sandi salah. Akun tidak dihapus.',
          fields: { password: 'Kata sandi salah.' },
        };
      }
      return failed(result);
    }
    (await cookies()).set(expiredSessionCookie());
    redirect(accountHrefs.notice('akun-dihapus'));
  });
}
