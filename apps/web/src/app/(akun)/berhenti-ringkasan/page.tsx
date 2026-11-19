import { TokenSchema } from '@kawan-pasar/contracts/auth';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthCard } from '@/components/molecules/AuthCard';
import { UnsubscribeForm } from '@/components/organisms/alerts/AlertForms';
import { unsubscribeWeeklyAction } from '@/lib/alerts/actions';

export const metadata: Metadata = { title: 'Berhenti menerima ringkasan mingguan' };

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Opened from the weekly summary e-mail. Like e-mail verification, a plain visit (or a mail
 * scanner following the link) changes nothing: only pressing the button does (POST).
 */
export default async function UnsubscribeWeeklyPage({
  searchParams,
}: {
  searchParams: Search;
}): Promise<ReactNode> {
  const t = (await searchParams)['t'];
  const token = typeof t === 'string' && TokenSchema.safeParse(t).success ? t : null;
  return (
    <AuthCard
      title="Ringkasan mingguan"
      lead="Tidak ingin lagi menerima ringkasan harga setiap Senin? Matikan dengan satu tombol."
      pose="halo"
    >
      {token === null ? (
        <p role="alert" className="text-body-medium-15">
          Tautan ini tidak lengkap atau tidak berlaku. Ringkasan juga bisa dimatikan di halaman{' '}
          <Link href="/peringatan" className="font-semibold text-green-900 underline">
            Peringatan
          </Link>
          .
        </p>
      ) : (
        <UnsubscribeForm action={unsubscribeWeeklyAction} token={token} />
      )}
    </AuthCard>
  );
}
