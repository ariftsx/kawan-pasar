import { TokenSchema } from '@kawan-pasar/contracts/auth';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthCard } from '@/components/molecules/AuthCard';
import { ResetPasswordForm } from '@/components/organisms/auth/AuthForms';
import { resetPasswordAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Atur ulang kata sandi' };

type Search = Promise<Record<string, string | string[] | undefined>>;

/**
 * Opened from the e-mailed link. Showing the page uses nothing: the token is only sent (POST)
 * when the user submits a new password, so link scanners cannot spend it. Referrer-Policy
 * no-referrer (proxy.ts) keeps the URL out of any Referer header.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Search;
}): Promise<ReactNode> {
  const t = (await searchParams)['t'];
  const token = typeof t === 'string' && TokenSchema.safeParse(t).success ? t : null;
  return (
    <AuthCard title="Buat kata sandi baru" pose="belajar">
      {token === null ? (
        <p role="alert" className="text-body-medium-15">
          Tautan ini tidak lengkap atau tidak berlaku.{' '}
          <Link href="/lupa-sandi" className="font-semibold text-green-900 underline">
            Minta tautan baru
          </Link>
          .
        </p>
      ) : (
        <ResetPasswordForm action={resetPasswordAction} token={token} />
      )}
    </AuthCard>
  );
}
