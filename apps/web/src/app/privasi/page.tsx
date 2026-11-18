import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageContainer } from '@/components/templates/SiteShell';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Kebijakan privasi',
  description: 'Data apa yang disimpan Kawan Pasar, untuk apa, berapa lama, dan hak Anda.',
  path: '/privasi',
});

const SECTIONS: readonly { title: string; items: readonly string[] }[] = [
  {
    title: 'Tanpa akun',
    items: [
      'Halaman harga, prediksi, dan edukasi bisa dipakai tanpa akun. Tidak ada analitik, iklan, atau pelacak pihak ketiga.',
      'Satu cookie fungsional (kp_onboarded) hanya mengingat bahwa Anda sudah melihat halaman orientasi.',
    ],
  },
  {
    title: 'Bila Anda membuat akun',
    items: [
      'Kami menyimpan email Anda dan kata sandi dalam bentuk hash Argon2id (kata sandi asli tidak pernah disimpan).',
      'Sesi masuk disimpan sebagai sidik token, bersama jenis peramban dan sistem operasi (misalnya "Chrome · Windows") agar Anda bisa melihat dan mengakhiri sesi.',
      'Catatan keamanan (masuk, gagal masuk, ganti kata sandi) disimpan 90 hari tanpa email; alamat IP hanya sebagai hash yang berganti setiap hari.',
      'Email hanya dipakai untuk verifikasi, atur ulang kata sandi, pemberitahuan keamanan akun, dan peringatan harga yang Anda aktifkan. Email yang gagal terkirim dihapus dari antrean paling lambat 1 hari.',
    ],
  },
  {
    title: 'Hak Anda (UU No. 27 Tahun 2022)',
    items: [
      'Melihat data akun dan sesi aktif Anda kapan saja di halaman Akun.',
      'Menghapus akun beserta datanya secara permanen dari halaman Akun. Catatan keamanan yang tersisa tidak lagi terhubung dengan Anda.',
    ],
  },
];

export default function PrivacyPage(): ReactNode {
  return (
    <PageContainer className="flex max-w-[760px] flex-col gap-8 py-8 sm:py-12">
      <div className="flex flex-col gap-2">
        <p className="text-overline-11 text-muted-text uppercase">Privasi</p>
        <h1 className="text-heading-h2-32 text-balance">Kebijakan privasi</h1>
        <p className="text-body-large-17 text-ink-2">
          Kami hanya menyimpan data yang perlu untuk menjalankan fitur yang Anda pakai.
        </p>
      </div>
      {SECTIONS.map((s) => (
        <section key={s.title} className="flex flex-col gap-3">
          <h2 className="text-heading-title-20">{s.title}</h2>
          <ul className="flex list-disc flex-col gap-2 pl-6 text-body-medium-15 text-ink-2">
            {s.items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-body-medium-15">
        <Link href="/daftar" className="font-semibold text-green-900 underline">
          Kembali ke pendaftaran
        </Link>
      </p>
    </PageContainer>
  );
}
