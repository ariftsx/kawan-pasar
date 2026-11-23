import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/atoms/Button';
import { adminContext } from '@/lib/admin/context';
import { adminApi } from '@/lib/auth/api';
import { adminHrefs } from '@/lib/hrefs';

/** Articles: drafts and published (Fase 3B task 6). */
export default async function AdminArticles(): Promise<ReactNode> {
  const { token } = await adminContext();
  const list = await adminApi.articles(token);
  return (
    <section aria-labelledby="artikel" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="artikel" className="text-heading-title-20">
          Artikel
        </h2>
        <Button href="/admin/artikel/baru" size="S">
          Artikel baru
        </Button>
      </div>
      {!list.ok ? (
        <p role="alert">Daftar artikel belum bisa dimuat.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
          {list.data.items.map((a) => (
            <li key={a.slug} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <Link href={adminHrefs.article(a.slug)} className="font-semibold underline">
                {a.title}
              </Link>
              <span className="text-body-small-13 text-ink-2">
                {a.status === 'published' ? 'Terbit' : 'Draf'} · revisi {a.revision}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
