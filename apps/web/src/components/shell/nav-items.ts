// Navigation from docs 05 §5.1. Routes not built yet render a "segera hadir" page, never a 404.
import type { IconName } from '@/components/icons';

export type NavItem = {
  readonly href: string;
  readonly label: string;
  readonly short: string;
  readonly icon: IconName;
};

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', label: 'Beranda', short: 'Beranda', icon: 'warung' },
  { href: '/pantau', label: 'Pantau Harga', short: 'Harga', icon: 'tag' },
  { href: '/rencana', label: 'Rencana Menu', short: 'Menu', icon: 'nota' },
  { href: '/outlook', label: 'Outlook ★', short: 'Outlook', icon: 'star' },
  { href: '/konteks', label: 'Konteks', short: 'Konteks', icon: 'more' },
  { href: '/pelajari', label: 'Pelajari', short: 'Pelajari', icon: 'more' },
];

/** Mobile bottom tabs: four destinations plus "Lainnya" (docs 05 §5.1). */
export const MOBILE_TABS: readonly NavItem[] = [
  ...PRIMARY_NAV.filter((item) => ['/', '/pantau', '/rencana', '/outlook'].includes(item.href)),
  { href: '/lainnya', label: 'Lainnya', short: 'Lainnya', icon: 'more' },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
