import Link from 'next/link';

import { Illustration } from '@/components/brand/illustration';
import { FOCUS, KataKapa, PageHeader, StatusChip } from '@/components/kp/blocks';

import type { Metadata, Route } from 'next';

export const metadata: Metadata = { title: 'Edukasi' };

const TOPICS: readonly { href: Route | null; title: string; body: string; tag: string }[] = [
  {
    href: '/edukasi/inflasi-pangan',
    title: 'Apa itu inflasi pangan?',
    body: 'Mengapa harga cabai dan bawang ikut menentukan angka inflasi yang diumumkan BPS.',
    tag: 'Dasar',
  },
  {
    href: '/arif-net',
    title: 'Cara membaca prediksi',
    body: 'Garis teramati, garis perkiraan, horizon, dan arti status “belum diuji”.',
    tag: 'Prediksi',
  },
  {
    href: '/arif-net/keterbatasan',
    title: 'Apa yang belum bisa dilakukan',
    body: 'Batasan data, model, dan produk yang perlu diketahui sebelum memakai angka di sini.',
    tag: 'Keterbatasan',
  },
  {
    href: null,
    title: 'Musim dan hari besar',
    body: 'Bagaimana kalender tercatat sebagai konteks pergerakan harga. Segera hadir.',
    tag: 'Menyusul',
  },
];

export default function EdukasiPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        overline="Edukasi"
        title="Belajar membaca harga pangan"
        description="Bacaan singkat agar angka harga dan prediksi lebih mudah dipahami."
        aside={<Illustration name="inflasi" className="hidden w-48 md:block" />}
      />
      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {TOPICS.map((topic) => {
          const body = (
            <>
              <StatusChip tone={topic.href === null ? 'neutral' : 'brand'} className="self-start">
                {topic.tag}
              </StatusChip>
              <span className="text-xl font-extrabold">{topic.title}</span>
              <span className="text-base text-text-secondary">{topic.body}</span>
            </>
          );
          const card =
            'flex h-full flex-col gap-3 rounded-3xl border border-border-default bg-bg-surface p-6';
          return (
            <li key={topic.title}>
              {topic.href === null ? (
                <div className={card}>{body}</div>
              ) : (
                <Link href={topic.href} className={`${card} hover:border-border-control ${FOCUS}`}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
      <KataKapa pose="belajar" title="Harga naik belum tentu karena satu sebab.">
        Cuaca, musim, distribusi, dan permintaan bisa terjadi bersamaan. Kawan Pasar menampilkan
        konteks, bukan menyimpulkan penyebab.
      </KataKapa>
    </div>
  );
}
