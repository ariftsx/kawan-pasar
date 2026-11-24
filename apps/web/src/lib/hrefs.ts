import type { CommodityCode } from '@kawan-pasar/catalog';
import type { Route } from 'next';
import { ACCOUNT_HOME, safeNext } from './auth/redirect';
import type { NOTICES } from './auth/messages';

/*
 * Public URLs with a parameter. They exist as rewrites (`/harga/[commodity]` → `/PIKJ/harga/…`),
 * which typed routes list but do not expand into template strings, hence the single cast here.
 * Parameters are typed (catalog codes, validated slugs), so the URLs are always valid.
 */
const route = (path: string): Route => path as Route;

export const hrefs = {
  price: (code: CommodityCode): Route => route(`/harga/${code}`),
  forecast: (code: CommodityCode): Route => route(`/prediksi/${code}`),
  article: (slug: string): Route => route(`/edukasi/${encodeURIComponent(slug)}`),
};

/**
 * Account destinations with a query or fragment (typed routes do not cover those). The target
 * after signing in always goes through `safeNext` (open-redirect guard).
 */
export const accountHrefs = {
  afterSignIn: (ke: string): Route => route(safeNext(ke)),
  signIn: (ke: string = ACCOUNT_HOME): Route =>
    route(`/masuk?ke=${encodeURIComponent(safeNext(ke))}`),
  notice: (key: keyof typeof NOTICES): Route => route(`/masuk?pesan=${key}`),
  sessions: (): Route => route(`${ACCOUNT_HOME}#sesi`),
  phone: (): Route => route(`${ACCOUNT_HOME}#hp`),
  analyst: (): Route => route(`${ACCOUNT_HOME}#mode-analis`),
};

/** The alerts page with a tab, a page cursor, or a "saved" notice (Fase 2B). */
export const alertHrefs = {
  list: (tab: 'all' | 'unread' | 'weekly', before?: number): Route =>
    route(`/peringatan?tab=${tab}${before === undefined ? '' : `&sebelum=${String(before)}`}`),
  whatsapp: (state: 'kode-terkirim' | 'terhubung' | 'terputus'): Route =>
    route(`/peringatan?wa=${state}#whatsapp`),
  saved: (section: 'pengaturan' | 'pantauan'): Route =>
    route(`/peringatan?disimpan=${section}#${section}`),
};

/** Admin pages with a notice after a change (Fase 3B); slugs are validated catalog-style slugs. */
export const adminHrefs = {
  requests: (notice?: 'diputuskan'): Route =>
    route(`/admin${notice === undefined ? '' : `?pesan=${notice}`}`),
  article: (slug: string, notice?: 'disimpan' | 'terbit' | 'ditarik' | 'dipulihkan'): Route =>
    route(
      `/admin/artikel/${encodeURIComponent(slug)}${notice === undefined ? '' : `?pesan=${notice}`}`,
    ),
  // Fase 4C.
  pipeline: (): Route => route('/admin/pipeline'),
  models: (notice?: 'disetujui' | 'ditolak'): Route =>
    route(`/admin/model${notice === undefined ? '' : `?pesan=${notice}`}`),
  model: (id: number): Route => route(`/admin/model/${String(id)}`),
};
