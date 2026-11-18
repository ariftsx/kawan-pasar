import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthCard } from '@/components/molecules/AuthCard';
import { RegisterForm } from '@/components/organisms/auth/AuthForms';
import { registerAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Daftar' };

export default function RegisterPage(): ReactNode {
  return (
    <AuthCard
      title="Buat akun"
      lead="Cukup email dan kata sandi. Kami hanya menyimpan yang perlu untuk mengirim peringatan harga."
      pose="senang"
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/masuk" className="font-semibold text-green-900 underline">
            Masuk
          </Link>
        </>
      }
    >
      <RegisterForm action={registerAction} />
    </AuthCard>
  );
}
