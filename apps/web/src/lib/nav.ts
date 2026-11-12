import type { Route } from 'next';
import type { FeatureIconName } from '@/brand/FeatureIcon';

export interface NavEntry {
  href: Route;
  label: string;
  icon: FeatureIconName;
}

/** Desktop top navigation (v0.4 NavBar). */
export const DESKTOP_NAV: readonly NavEntry[] = [
  { href: '/beranda', label: 'Beranda', icon: 'beranda' },
  { href: '/harga', label: 'Harga', icon: 'harga' },
  { href: '/prediksi', label: 'Prediksi', icon: 'prediksi' },
  { href: '/edukasi', label: 'Edukasi', icon: 'edukasi' },
  { href: '/arif-net', label: 'ARIF-Net', icon: 'arif-net' },
];

/** Mobile bottom tabs (v0.4 TabBar). ARIF-Net and the rest live under "Lainnya". */
export const MOBILE_TABS: readonly NavEntry[] = [
  { href: '/beranda', label: 'Beranda', icon: 'beranda' },
  { href: '/harga', label: 'Harga', icon: 'harga' },
  { href: '/prediksi', label: 'Prediksi', icon: 'prediksi' },
  { href: '/edukasi', label: 'Edukasi', icon: 'edukasi' },
  { href: '/lainnya', label: 'Lainnya', icon: 'lainnya' },
];

/** A section is active on its own page and on every page below it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
