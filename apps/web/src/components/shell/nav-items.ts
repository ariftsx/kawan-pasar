// Navigation of Kawan Pasar v0.4: price monitoring, ARIF-Net forecasts, and food-inflation
// literacy. Desktop shows five destinations; mobile shows four tabs plus "Lainnya".
import type { FeatureIconName } from '@/components/brand/feature-icon';
import type { Route } from 'next';

export type NavItem = {
  readonly href: Route;
  readonly label: string;
  readonly icon: FeatureIconName;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', label: 'Beranda', icon: 'beranda' },
  { href: '/harga', label: 'Harga', icon: 'harga' },
  { href: '/prediksi', label: 'Prediksi', icon: 'prediksi' },
  { href: '/edukasi', label: 'Edukasi', icon: 'edukasi' },
  { href: '/arif-net', label: 'ARIF-Net', icon: 'arif-net' },
];

export const MOBILE_TABS: readonly NavItem[] = [
  { href: '/', label: 'Beranda', icon: 'beranda' },
  { href: '/harga', label: 'Harga', icon: 'harga' },
  { href: '/prediksi', label: 'Prediksi', icon: 'prediksi' },
  { href: '/peringatan', label: 'Peringatan', icon: 'peringatan' },
  { href: '/lainnya', label: 'Lainnya', icon: 'lainnya' },
];

/** Secondary destinations listed on /lainnya (mobile) and in the footer. */
export const SECONDARY_NAV: readonly (NavItem & { readonly note: string })[] = [
  { href: '/edukasi', label: 'Edukasi', icon: 'edukasi', note: 'Literasi inflasi pangan' },
  { href: '/arif-net', label: 'ARIF-Net', icon: 'arif-net', note: 'Cara kerja model prediksi' },
  {
    href: '/arif-net/keterbatasan',
    label: 'Keterbatasan',
    icon: 'info',
    note: 'Batasan data, model, dan produk',
  },
  { href: '/analis', label: 'Mode Analis', icon: 'unduh', note: 'Tabel sinyal dan unduh data' },
  { href: '/pasar', label: 'Pilih pasar', icon: 'pasar', note: 'Pasar Kramat Jati dan lainnya' },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
