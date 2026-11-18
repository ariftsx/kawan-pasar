import { TokenSchema } from '@kawan-pasar/contracts/auth';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthCard } from '@/components/molecules/AuthCard';
import { VerifyEmailForm } from '@/components/organisms/auth/AuthForms';
import { verifyEmailAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Verifikasi email' };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Opened from the e-mailed link; verifying needs a button press (POST), never a plain visit. */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Search;
}): Promise<ReactNode> {
  const t = (await searchParams)['t'];
  const token = typeof t === 'string' && TokenSchema.safeParse(t).success ? t : null;
  return (
    <AuthCard
      title="Verifikasi email"
      lead="Satu langkah lagi: pastikan email ini milik Anda agar peringatan harga bisa dikirim."
      pose="senang"
    >
      {token === null ? (
        <p role="alert" className="text-body-medium-15">
          Tautan ini tidak lengkap atau tidak berlaku. Masuk ke{' '}
          <Link href="/akun" className="font-semibold text-green-900 underline">
            akun Anda
          </Link>{' '}
          untuk mengirim tautan baru.
        </p>
      ) : (
        <VerifyEmailForm action={verifyEmailAction} token={token} />
      )}
    </AuthCard>
  );
}
