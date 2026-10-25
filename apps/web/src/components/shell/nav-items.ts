// Navigation from docs 05 §5.1. Routes not built yet render a "segera hadir" page, never a 404.
export type NavItem = { readonly href: string; readonly label: string; readonly short: string };

export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/', label: 'Beranda', short: 'Beranda' },
  { href: '/pantau', label: 'Pantau Harga', short: 'Pantau' },
  { href: '/rencana', label: 'Rencana Menu', short: 'Rencana' },
  { href: '/outlook', label: 'Outlook ★', short: 'Outlook' },
  { href: '/konteks', label: 'Konteks', short: 'Konteks' },
  { href: '/pelajari', label: 'Pelajari', short: 'Pelajari' },
];

/** Mobile bottom tabs: four destinations plus "Lainnya" (docs 05 §5.1). */
export const MOBILE_TABS: readonly NavItem[] = [
  ...PRIMARY_NAV.filter((item) => ['/', '/pantau', '/rencana', '/outlook'].includes(item.href)),
  { href: '/lainnya', label: 'Lainnya', short: 'Lainnya' },
];

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
