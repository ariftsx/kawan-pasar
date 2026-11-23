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
