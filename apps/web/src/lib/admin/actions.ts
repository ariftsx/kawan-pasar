'use server';

import {
  AdminArticleCreateSchema,
  AdminArticleUpdateSchema,
  AdminDecisionInputSchema,
  AdminUserSearchInputSchema,
  ArticleSlugSchema,
} from '@kawan-pasar/contracts';
import { redirect } from 'next/navigation';
import { endSession, failed, text, withSession } from '../auth/action-helpers';
import type { AuthResult } from '../auth/api';
import { adminApi } from '../auth/api';
import type { FormState } from '../auth/form-state';
import { adminHrefs } from '../hrefs';

// Admin Server Actions (Fase 3B). Every change needs the password confirmed in the last 10
// minutes. Instead of a separate page (which would lose a long article being edited), each form
// carries an optional password field: when it is filled, the action confirms first and then
// runs; when the API answers reauth_required, the form comes back with its values and asks.

const CONFIRM_MSG = 'Masukkan kata sandi Anda untuk melanjutkan perubahan.';

/** Article field and body problems from the API, by name. */
const ARTICLE_PROBLEM: Record<string, string> = {
  slug: 'Slug hanya huruf kecil, angka, dan tanda hubung (mis. harga-cabai-musim-hujan), dan belum dipakai.',
  title: 'Judul wajib diisi, paling panjang 120 karakter.',
  summary: 'Ringkasan wajib diisi, paling panjang 300 karakter.',
  category: 'Pilih kategori.',
  bodyMd: 'Isi artikel wajib diisi.',
  size: 'Isi artikel paling besar 50 KB.',
  link: 'Tautan hanya boleh https:// atau alamat di dalam Kawan Pasar (diawali /).',
  image_origin: 'Gambar hanya boleh dari situs yang diizinkan (lihat petunjuk di bawah isi).',
  image_alt: 'Setiap gambar perlu teks deskripsi: ![deskripsi](alamat-gambar).',
  html: 'HTML tidak didukung. Gunakan format Markdown saja.',
  revision:
    'Artikel ini sudah disimpan orang lain sejak Anda membukanya. Salin perubahan Anda, muat ulang, lalu simpan lagi.',
  decided: 'Pengajuan ini sudah diputuskan.',
  role: 'Akun ini bukan Analis.',
};

type Values = NonNullable<FormState['values']>;

/**
 * Runs one admin change: optional confirmation from the form's password field, then the call.
 * Returns null on success (the caller redirects), or the state to show.
 */
async function change<T>(
  session: string,
  form: FormData,
  values: Values,
  run: (csrf: string) => Promise<AuthResult<T>>,
): Promise<{ ok: true; data: T } | { ok: false; state: FormState }> {
  const csrf = text(form, 'csrf');
  const password = text(form, 'adminPassword');
  const confirmedNow = password !== '';
  if (confirmedNow) {
    const confirmed = await adminApi.confirm(session, csrf, password);
    if (!confirmed.ok) {
      if (confirmed.code === 'unauthenticated') return endSession();
      return { ok: false, state: { ...failed(confirmed, values), needsConfirm: true } };
    }
  }
  const result = await run(csrf);
  if (result.ok) return { ok: true, data: result.data };
  if (result.code === 'unauthenticated') return endSession();
  if (result.code === 'reauth_required') {
    return {
      ok: false,
      state: { status: 'error', message: CONFIRM_MSG, needsConfirm: true, values },
    };
  }
  // The password was accepted even though the change failed: the form must stop asking for it.
  const extra = confirmedNow ? { confirmedNow: true } : {};
  const named = (result.fields ?? []).map((f) => ARTICLE_PROBLEM[f]).filter((m) => m !== undefined);
  if (named.length > 0) {
    const fields = Object.fromEntries(
      (result.fields ?? []).flatMap((f) => {
        const m = ARTICLE_PROBLEM[f];
        // Body problems belong to the body field.
        const key = ['size', 'link', 'image_origin', 'image_alt', 'html'].includes(f)
          ? 'bodyMd'
          : f;
        return m === undefined ? [] : [[key, m]];
      }),
    );
    return {
      ok: false,
      state: { status: 'error', message: named.join(' '), fields, values, ...extra },
    };
  }
  return { ok: false, state: { ...failed(result, values), ...extra } };
}

export async function decideRequestAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const id = Number(text(form, 'id'));
    const note = text(form, 'note').trim();
    const input = AdminDecisionInputSchema.safeParse({
      decision: text(form, 'decision'),
      ...(note === '' ? {} : { note }),
    });
    if (!Number.isInteger(id) || id <= 0 || !input.success) {
      return { status: 'error', message: 'Catatan paling panjang 500 karakter.', values: { note } };
    }
    const r = await change(session, form, { note }, (csrf) =>
      adminApi.decide(session, csrf, id, input.data),
    );
    if (!r.ok) return r.state;
    redirect(adminHrefs.requests('diputuskan'));
  }, '/admin');
}

export async function searchUserAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const email = text(form, 'email');
    const input = AdminUserSearchInputSchema.safeParse({ email });
    if (!input.success) {
      return { status: 'error', message: 'Tulis alamat email lengkap.', values: { email } };
    }
    // Searching changes nothing: no confirmation needed (POST only so the address stays out of URLs).
    const r = await adminApi.searchUser(session, text(form, 'csrf'), input.data.email);
    if (!r.ok) return r.code === 'unauthenticated' ? endSession() : failed(r, { email });
    return { status: 'done', found: r.data.user, values: { email: input.data.email } };
  }, '/admin/pengguna');
}

export async function revokeAnalystAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const id = text(form, 'id');
    const r = await change(session, form, {}, (csrf) => adminApi.revokeAnalyst(session, csrf, id));
    if (!r.ok) return r.state;
    return {
      status: 'done',
      message: 'Peran Analis sudah dicabut. Unduhan berikutnya akan ditolak.',
    };
  }, '/admin/pengguna');
}

function articleValues(form: FormData): Values {
  return {
    slug: text(form, 'slug').trim(),
    category: text(form, 'category'),
    title: text(form, 'title'),
    summary: text(form, 'summary'),
    bodyMd: text(form, 'bodyMd').replace(/\r\n/g, '\n'),
  };
}

export async function createArticleAction(_prev: FormState, form: FormData): Promise<FormState> {
  return withSession(async (session) => {
    const values = articleValues(form);
    const input = AdminArticleCreateSchema.safeParse(values);
    if (!input.success) {
      const field = String(input.error.issues[0]?.path[0] ?? 'bodyMd');
      const message = ARTICLE_PROBLEM[field] ?? 'Periksa kembali isian yang ditandai.';
      return { status: 'error', message, fields: { [field]: message }, values };
    }
    const r = await change(session, form, values, (csrf) =>
      adminApi.createArticle(session, csrf, input.data),
    );
    if (!r.ok) return r.state;
    redirect(adminHrefs.article(input.data.slug, 'disimpan'));
  }, '/admin/artikel/baru');
}

export async function updateArticleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = ArticleSlugSchema.safeParse(text(form, 'slug'));
  return withSession(async (session) => {
    const values = articleValues(form);
    if (!slug.success) return { status: 'error', message: 'Artikel tidak dikenal.' };
    const input = AdminArticleUpdateSchema.safeParse({
      category: values.category,
      title: values.title,
      summary: values.summary,
      bodyMd: values.bodyMd,
      baseRevision: Number(text(form, 'baseRevision')),
    });
    if (!input.success) {
      const field = String(input.error.issues[0]?.path[0] ?? 'bodyMd');
      const message = ARTICLE_PROBLEM[field] ?? 'Periksa kembali isian yang ditandai.';
      return { status: 'error', message, fields: { [field]: message }, values };
    }
    const r = await change(session, form, values, (csrf) =>
      adminApi.updateArticle(session, csrf, slug.data, input.data),
    );
    if (!r.ok) return r.state;
    redirect(adminHrefs.article(slug.data, 'disimpan'));
  }, '/admin/artikel');
}

export async function publishArticleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = ArticleSlugSchema.safeParse(text(form, 'slug'));
  const publish = text(form, 'publish') === '1';
  return withSession(async (session) => {
    if (!slug.success) return { status: 'error', message: 'Artikel tidak dikenal.' };
    const r = await change(session, form, {}, (csrf) =>
      adminApi.publishArticle(session, csrf, slug.data, publish),
    );
    if (!r.ok) return r.state;
    redirect(adminHrefs.article(slug.data, publish ? 'terbit' : 'ditarik'));
  }, '/admin/artikel');
}

export async function restoreArticleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const slug = ArticleSlugSchema.safeParse(text(form, 'slug'));
  return withSession(async (session) => {
    const revision = Number(text(form, 'revision'));
    const baseRevision = Number(text(form, 'baseRevision'));
    if (!slug.success || !Number.isInteger(revision) || !Number.isInteger(baseRevision)) {
      return { status: 'error', message: 'Revisi tidak dikenal.' };
    }
    const r = await change(session, form, {}, (csrf) =>
      adminApi.restoreArticle(session, csrf, slug.data, { revision, baseRevision }),
    );
    if (!r.ok) return r.state;
    redirect(adminHrefs.article(slug.data, 'dipulihkan'));
  }, '/admin/artikel');
}
