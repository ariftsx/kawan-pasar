'use server';

import {
  AlertPreferencesSchema,
  TokenSchema,
  WatchIdSchema,
  WatchInputSchema,
  WatchUpdateSchema,
  WhatsAppVerifyInputSchema,
} from '@kawan-pasar/contracts';
import { redirect } from 'next/navigation';
import { endSession, failed, text, withSession } from '../auth/action-helpers';
import type { AuthResult } from '../auth/api';
import { alertsApi, whatsappApi } from '../auth/api';
import type { FormState } from '../auth/form-state';
import { alertHrefs } from '../hrefs';
import { parseRupiah } from './rupiah';

// Alert Server Actions (Fase 2B). Same rules as the account actions: contract check first,
// the session's CSRF token from the rendered form, then the Core API. After a change the
// page is loaded again (post/redirect/get), so it always shows what the API stored.

const BACK = '/peringatan';
const LIMIT_MSG = 'Tulis batas harga dalam rupiah, misalnya 39.000.';

async function handle(result: AuthResult<null>): Promise<FormState | null> {
  if (result.ok) return null;
  if (result.code === 'unauthenticated') return endSession();
  return failed(result);
}

function limitFrom(form: FormData): FormState | { value: number | null } {
  const value = parseRupiah(text(form, 'threshold'));
  if (value !== null && Number.isNaN(value)) {
    return { status: 'error', message: LIMIT_MSG, fields: { threshold: LIMIT_MSG } };
  }
  return { value };
}

export async function savePreferencesAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const on = (name: string): boolean => form.get(name) === 'on';
    const input = AlertPreferencesSchema.parse({
      inApp: on('inApp'),
      weekly: on('weekly'),
      unusualMove: on('unusualMove'),
      forecastRise: on('forecastRise'),
      priceThreshold: on('priceThreshold'),
      // The switch is shown only for a connected channel; otherwise the form keeps its value.
      whatsapp: on('whatsapp'),
    });
    const problem = await handle(
      await alertsApi.savePreferences(session, text(form, 'csrf'), input),
    );
    if (problem !== null) return problem;
    redirect(alertHrefs.saved('pengaturan'));
  }, BACK);
}

export async function addWatchAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const limit = limitFrom(form);
    if ('status' in limit) return limit;
    const input = WatchInputSchema.safeParse({
      commodity: text(form, 'commodity'),
      ...(limit.value === null
        ? {}
        : { threshold: { thresholdIdr: limit.value, direction: text(form, 'direction') } }),
    });
    if (!input.success) {
      return {
        status: 'error',
        message: 'Pilih komoditas dan arah batas harga.',
        fields: { commodity: 'Pilih komoditas dari daftar.' },
      };
    }
    const problem = await handle(await alertsApi.addWatch(session, text(form, 'csrf'), input.data));
    if (problem !== null) return problem;
    redirect(alertHrefs.saved('pantauan'));
  }, BACK);
}

export async function updateWatchAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const id = WatchIdSchema.safeParse(text(form, 'id'));
    const limit = limitFrom(form);
    if ('status' in limit) return limit;
    const input = WatchUpdateSchema.safeParse({
      threshold:
        limit.value === null
          ? null
          : { thresholdIdr: limit.value, direction: text(form, 'direction') },
    });
    if (!id.success || !input.success) {
      return { status: 'error', message: LIMIT_MSG, fields: { threshold: LIMIT_MSG } };
    }
    const result = await alertsApi.updateWatch(session, text(form, 'csrf'), id.data, input.data);
    const problem = await handle(result);
    if (problem !== null) return problem;
    redirect(alertHrefs.saved('pantauan'));
  }, BACK);
}

export async function removeWatchAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const id = WatchIdSchema.safeParse(text(form, 'id'));
    if (!id.success) return { status: 'error', message: 'Pantauan tidak ditemukan.' };
    const result = await alertsApi.removeWatch(session, text(form, 'csrf'), id.data);
    if (!result.ok && result.code !== 'not_found') return handle(result);
    redirect(alertHrefs.saved('pantauan'));
  }, BACK);
}

export async function markAllReadAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const result = await alertsApi.markRead(session, text(form, 'csrf'), { all: true });
    const problem = await handle(result);
    if (problem !== null) return problem;
    // Back to the tab the user was on (only the known tabs; anything else is "all").
    const tab = text(form, 'tab');
    redirect(alertHrefs.list(tab === 'unread' || tab === 'weekly' ? tab : 'all'));
  }, BACK);
}

/** The weekly summary e-mail's link: no session, the single-use token is the proof. */
export async function unsubscribeWeeklyAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const token = TokenSchema.safeParse(text(form, 'token'));
  if (!token.success) return failed({ ok: false, code: 'invalid_token' });
  const result = await alertsApi.unsubscribeWeekly(token.data);
  if (!result.ok) return failed(result);
  return {
    status: 'done',
    message:
      'Ringkasan mingguan sudah dimatikan. Anda bisa menyalakannya lagi di halaman Peringatan.',
  };
}

const CODE_MSG = 'Masukkan 6 angka kode dari WhatsApp.';

export async function sendWhatsAppCodeAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const result = await whatsappApi.sendCode(session, text(form, 'csrf'));
    if (!result.ok) {
      if (result.code === 'unauthenticated') return endSession();
      if (result.code === 'rate_limited') {
        return { status: 'error', message: 'Terlalu banyak kode diminta. Coba lagi nanti.' };
      }
      return failed(result);
    }
    redirect(alertHrefs.whatsapp('kode-terkirim'));
  }, BACK);
}

export async function verifyWhatsAppAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const input = WhatsAppVerifyInputSchema.safeParse({ code: text(form, 'code') });
    if (!input.success) return { status: 'error', message: CODE_MSG, fields: { code: CODE_MSG } };
    const result = await whatsappApi.verify(session, text(form, 'csrf'), input.data.code);
    if (!result.ok) {
      if (result.code === 'unauthenticated') return endSession();
      if (result.code === 'invalid_token') {
        const expired = result.fields?.[0] === 'expired';
        const message = expired
          ? 'Kode sudah tidak berlaku. Minta kode baru.'
          : 'Kode salah. Periksa lagi pesan WhatsApp Anda.';
        return { status: 'error', message, fields: { code: message } };
      }
      return failed(result);
    }
    redirect(alertHrefs.whatsapp('terhubung'));
  }, BACK);
}

export async function disconnectWhatsAppAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  return withSession(async (session) => {
    const result = await whatsappApi.disconnect(session, text(form, 'csrf'));
    if (!result.ok) return result.code === 'unauthenticated' ? endSession() : failed(result);
    redirect(alertHrefs.whatsapp('terputus'));
  }, BACK);
}
