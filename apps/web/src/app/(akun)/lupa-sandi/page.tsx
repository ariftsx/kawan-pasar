import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AuthCard } from '@/components/molecules/AuthCard';
import { ForgotPasswordForm } from '@/components/organisms/auth/AuthForms';
import { forgotPasswordAction } from '@/lib/auth/actions';

export const metadata: Metadata = { title: 'Lupa kata sandi' };

export default function ForgotPasswordPage(): ReactNode {
  return (
    <AuthCard
      title="Lupa kata sandi?"
      lead="Masukkan email akun Anda. Kami kirim tautan untuk membuat kata sandi baru."
      pose="menunjuk"
      footer={
        <Link href="/masuk" className="font-semibold text-green-900 underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ForgotPasswordForm action={forgotPasswordAction} />
    </AuthCard>
  );
}
