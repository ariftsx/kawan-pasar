'use server';

import { AnalystRequestInputSchema } from '@kawan-pasar/contracts';
import { endSession, failed, text, withSession } from '../auth/action-helpers';
import { analystApi } from '../auth/api';
import type { FormState } from '../auth/form-state';
import { accountHrefs } from '../hrefs';

const REASON_MSG = 'Tuliskan keperluan Anda dalam 10–500 karakter.';

const CONFLICT: Record<string, string> = {
  pending: 'Pengajuan Anda sebelumnya masih ditinjau.',
  email: 'Verifikasi email Anda dulu sebelum mengajukan peran Analis.',
  role: 'Akun Anda sudah memiliki peran Analis.',
};

/** Requests the Analyst role (Fase 3A); decided by an admin (CLI until Fase 3B). */
export async function requestAnalystAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const organization = text(form, 'organization').trim();
    const input = AnalystRequestInputSchema.safeParse({
      reason: text(form, 'reason'),
      ...(organization === '' ? {} : { organization }),
    });
    const values = {
      reason: text(form, 'reason').slice(0, 500),
      organization: organization.slice(0, 120),
    };
    if (!input.success) {
      return { status: 'error', message: REASON_MSG, fields: { reason: REASON_MSG }, values };
    }
    const result = await analystApi.request(session, text(form, 'csrf'), input.data);
    if (!result.ok) {
      if (result.code === 'unauthenticated') return endSession();
      const known = result.code === 'conflict' ? CONFLICT[result.fields?.[0] ?? ''] : undefined;
      return known === undefined ? failed(result, values) : { status: 'error', message: known };
    }
    return { status: 'done', message: 'Pengajuan terkirim. Kami kabari lewat halaman ini.' };
  }, accountHrefs.analyst());
}
