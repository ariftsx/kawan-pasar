import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthCard } from '@/components/molecules/AuthCard';
import { LoginForm } from '@/components/organisms/auth/AuthForms';
import { loginAction } from '@/lib/auth/actions';
import { NOTICES } from '@/lib/auth/messages';
import { safeNext } from '@/lib/auth/redirect';

export const metadata: Metadata = { title: 'Masuk' };

type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Search;
}): Promise<ReactNode> {
  const params = await searchParams;
  const pesan = typeof params['pesan'] === 'string' ? params['pesan'] : '';
  // Only known notice keys are shown; the query text itself is never rendered.
  const notice = Object.hasOwn(NOTICES, pesan) ? NOTICES[pesan as keyof typeof NOTICES] : null;
  return (
    <AuthCard
      title="Masuk ke Kawan Pasar"
      lead="Masuk untuk mengatur peringatan harga komoditas yang Anda pantau."
      pose="halo"
      footer={
        <>
          Belum punya akun?{' '}
          <Link href="/daftar" className="font-semibold text-green-900 underline">
            Daftar
          </Link>
        </>
      }
    >
      {notice === null ? null : (
        <p role="status" className="rounded-md border border-green-700 bg-green-100 px-4 py-3">
          {notice}
        </p>
      )}
      <LoginForm action={loginAction} next={safeNext(params['ke'])} />
    </AuthCard>
  );
}
