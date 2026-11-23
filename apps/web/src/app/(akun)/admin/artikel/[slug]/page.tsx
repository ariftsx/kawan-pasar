import { ArticleSlugSchema } from '@kawan-pasar/contracts';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArticleEditor, PublishForm, RestoreForm } from '@/components/organisms/admin/AdminForms';
import { ConfirmStatus } from '@/components/organisms/admin/ConfirmStatus';
import { ArticleBody } from '@/components/organisms/ArticleBody';
import {
  publishArticleAction,
  restoreArticleAction,
  updateArticleAction,
} from '@/lib/admin/actions';
import { adminContext } from '@/lib/admin/context';
import { adminApi } from '@/lib/auth/api';
import { hrefs } from '@/lib/hrefs';
import { IMAGE_ORIGINS } from '@/lib/image-origins';

const NOTICE: Record<string, string> = {
  disimpan: 'Perubahan tersimpan sebagai revisi baru.',
  terbit: 'Artikel terbit dan tampil di halaman Edukasi.',
  ditarik: 'Artikel ditarik dan tidak lagi tampil untuk publik.',
  dipulihkan: 'Revisi lama dipulihkan sebagai revisi baru.',
};

const when = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Edit, preview, publish and restore one article (Fase 3B task 6). */
export default async function EditArticle({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pesan?: string }>;
}): Promise<ReactNode> {
  const slug = ArticleSlugSchema.safeParse((await params).slug);
  if (!slug.success) notFound();
  const { token, csrf, confirmedUntil } = await adminContext();
  const [res, { pesan }] = await Promise.all([adminApi.article(token, slug.data), searchParams]);
  if (!res.ok) {
    if (res.code === 'not_found') notFound();
    return <p role="alert">Artikel belum bisa dimuat.</p>;
  }
  const a = res.data;
  const confirmed = confirmedUntil !== null;
  const notice = pesan === undefined ? undefined : NOTICE[pesan];
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading-title-20">{a.title}</h2>
          <p className="text-body-small-13 text-ink-2">
            {a.published ? 'Terbit' : 'Draf'} · revisi {a.revision} · {a.readingMinutes} menit baca
            {a.published ? (
              <>
                {' · '}
                <a href={hrefs.article(a.slug)} className="underline">
                  lihat di situs
                </a>
              </>
            ) : null}
          </p>
        </div>
        <PublishForm
          action={publishArticleAction}
          csrf={csrf}
          slug={a.slug}
          published={a.published}
          confirmed={confirmed}
        />
      </div>
      <ConfirmStatus confirmedUntil={confirmedUntil} />
      {notice === undefined ? null : (
        <p role="status" className="text-body-medium-15 text-green-700">
          {notice}
        </p>
      )}
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="sunting" className="flex min-w-0 flex-col gap-4">
          <h3 id="sunting" className="text-heading-card-16">
            Sunting
          </h3>
          <ArticleEditor
            action={updateArticleAction}
            csrf={csrf}
            confirmed={confirmed}
            article={a}
            imageOrigins={IMAGE_ORIGINS}
          />
        </section>
        <section aria-labelledby="pratinjau" className="flex min-w-0 flex-col gap-4">
          <h3 id="pratinjau" className="text-heading-card-16">
            Pratinjau (versi tersimpan)
          </h3>
          <div className="rounded-xl border border-line bg-surface p-5">
            <p className="text-heading-title-20">{a.title}</p>
            <p className="mt-2 text-body-medium-15 text-ink-2">{a.summary}</p>
            <ArticleBody markdown={a.bodyMd} />
          </div>
        </section>
      </div>
      <section aria-labelledby="riwayat" className="flex flex-col gap-3">
        <h3 id="riwayat" className="text-heading-card-16">
          Riwayat revisi
        </h3>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
          {a.revisions.map((r) => (
            <li key={r.revision} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <span className="text-[14px]">
                Revisi {r.revision} · {when.format(new Date(r.createdAt))} WIB ·{' '}
                {r.by ?? 'impor awal'}
                {r.revision === a.revision ? ' · versi sekarang' : ''}
              </span>
              {r.revision === a.revision ? null : (
                <RestoreForm
                  action={restoreArticleAction}
                  csrf={csrf}
                  slug={a.slug}
                  revision={r.revision}
                  baseRevision={a.revision}
                  confirmed={confirmed}
                />
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
