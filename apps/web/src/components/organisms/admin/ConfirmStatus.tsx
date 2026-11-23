import type { ReactNode } from 'react';

const time = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
});

/**
 * Whether changes still need the password. Rendered by each page (not the layout): Next.js keeps
 * layouts across navigations, so a layout would show a stale state after a confirmation.
 */
export function ConfirmStatus({ confirmedUntil }: { confirmedUntil: string | null }): ReactNode {
  return (
    <p className="text-body-small-13 text-ink-2">
      {confirmedUntil === null
        ? 'Perubahan meminta kata sandi Anda.'
        : `Perubahan tanpa kata sandi sampai ${time.format(new Date(confirmedUntil))} WIB.`}
    </p>
  );
}
