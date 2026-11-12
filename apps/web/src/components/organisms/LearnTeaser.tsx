import type { ArticleCategory, ArticleListItem } from '@kawan-pasar/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Illustration } from '@/brand/Illustration';
import type { IllustrationName } from '@/brand/Illustration';
import { cx } from '@/lib/cx';
import { hrefs } from '@/lib/hrefs';
import { Chip } from '../atoms/Chip';

export const CATEGORY: Record<
  ArticleCategory,
  { label: string; illustration: IllustrationName; tint: string }
> = {
  dasar: { label: 'Dasar', illustration: 'inflasi', tint: 'bg-kunyit-100' },
  prediksi: { label: 'Prediksi', illustration: 'lapak', tint: 'bg-green-100' },
  'arif-net': { label: 'ARIF-Net', illustration: 'arif-net', tint: 'bg-terong-100' },
  keterbatasan: { label: 'Keterbatasan', illustration: 'peta', tint: 'bg-surface-2' },
};

/** Article card (v0.4 "Belajar sambil belanja"). Only published articles reach this component. */
export function ArticleCard({ article }: { article: ArticleListItem }): ReactNode {
  const c = CATEGORY[article.category];
  return (
    <article className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow focus-within:shadow-[0_0_0_3px_var(--color-terong-600)] hover:shadow-[0_6px_20px_#14201A0F]">
      <div className={cx('flex h-36 items-center justify-center overflow-hidden', c.tint)}>
        <Illustration name={c.illustration} className="max-h-36" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <p className="flex flex-wrap gap-1.5">
          <Chip tone="kunyit" size="S">
            {c.label}
          </Chip>
          <Chip tone="neutral" size="S">
            {article.readingMinutes} menit
          </Chip>
        </p>
        <h3 className="text-heading-card-16">
          <Link
            href={hrefs.article(article.slug)}
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {article.title}
          </Link>
        </h3>
        <p className="text-body-small-13 text-ink-2">{article.summary}</p>
      </div>
    </article>
  );
}

/** Up to three published articles; the rest are announced without titles. */
export function LearnTeaser({ articles }: { articles: readonly ArticleListItem[] }): ReactNode {
  return (
    <ul className="grid gap-4 sm:grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-[repeat(3,minmax(0,1fr))]">
      {articles.slice(0, 3).map((a) => (
        <li key={a.slug} className="min-w-0">
          <ArticleCard article={a} />
        </li>
      ))}
      {articles.length < 3 ? (
        <li className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-line p-5 text-center text-body-small-13 text-muted-text">
          Topik lain sedang ditinjau dan segera hadir.
        </li>
      ) : null}
    </ul>
  );
}
