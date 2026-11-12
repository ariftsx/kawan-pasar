import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { Illustration } from '@/brand/Illustration';
import { Button } from '@/components/atoms/Button';
import { Chip } from '@/components/atoms/Chip';
import { Delta } from '@/components/atoms/Delta';
import { Price } from '@/components/atoms/Price';
import { KataKapa } from '@/components/molecules/KataKapa';
import { ArticleBody, headingsOf } from '@/components/organisms/ArticleBody';
import { CATEGORY } from '@/components/organisms/LearnTeaser';
import { PageContainer } from '@/components/templates/SiteShell';
import { requireData } from '@/lib/api/client';
import { api } from '@/lib/api/endpoints';
import { cx } from '@/lib/cx';
import { formatDateWib } from '@/lib/format';
import { hrefs } from '@/lib/hrefs';
import { marketFrom } from '@/lib/page-params';
import { pageMetadata } from '@/lib/seo';

export const revalidate = 21_600;
export const dynamicParams = true;
export function generateStaticParams(): { market: string; slug: string }[] {
  return [];
}

type Params = Promise<{ market: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const list = await api.articles();
  const article = list.ok ? list.data.items.find((a) => a.slug === slug) : undefined;
  return article === undefined
    ? { title: 'Artikel' }
    : pageMetadata({
        title: article.title,
        description: article.summary,
        path: hrefs.article(slug),
      });
}

/**
 * Article page (v0.4 "Artikel"). The slug is checked against the (cached) list of published
 * articles first, so unknown slugs never reach the article endpoint (ADR 0009).
 */
export default async function Artikel({ params }: { params: Params }): Promise<ReactNode> {
  const market = await marketFrom(params);
  const { slug } = await params;
  const { items } = requireData(await api.articles());
  const index = items.findIndex((a) => a.slug === slug);
  if (index === -1) notFound();
  const [articleRes, summaryRes] = await Promise.all([api.article(slug), api.priceSummary(market)]);
  const article = requireData(articleRes);
  const summary = requireData(summaryRes);
  const next = items[index + 1];
  const toc = headingsOf(article.bodyMd);
  const category = CATEGORY[article.category];
  const examples = summary.items.filter((i) => i.latest !== null).slice(0, 3);

  return (
    <PageContainer className="flex flex-col gap-8 py-6 lg:py-10">
      <header className="flex max-w-3xl flex-col gap-3">
        <p className="flex flex-wrap gap-1.5">
          <Chip tone="green" size="S">
            Edukasi
          </Chip>
          <Chip tone="neutral" size="S">
            {category.label} · {article.readingMinutes} menit
          </Chip>
        </p>
        <h1 className="text-heading-h3-24 sm:text-heading-h2-32 lg:text-heading-h1-40 text-balance">
          {article.title}
        </h1>
        <p className="text-body-medium-15 text-ink-2">{article.summary}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="min-w-0">
          <div
            className={cx(
              'mb-6 flex h-48 items-center justify-center overflow-hidden rounded-xl',
              category.tint,
            )}
          >
            <Illustration name={category.illustration} className="max-h-48" />
          </div>
          <ArticleBody markdown={article.bodyMd} />

          {examples.length === 0 ? null : (
            <section aria-labelledby="contoh-title" className="mt-8 rounded-xl bg-green-100 p-5">
              <h2 id="contoh-title" className="text-overline-11 text-green-900 uppercase">
                Contoh dari data Kawan Pasar
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                {examples.map((i) => (
                  <li key={i.code} className="flex flex-col gap-1 rounded-lg bg-surface p-4">
                    <span className="text-[13px] font-semibold">{i.name}</span>
                    <Price value={i.latest?.priceIdr ?? null} size="m" />
                    <span className="flex items-center gap-1 text-[11px] text-muted-text">
                      <Delta value={i.change30d} size="S" /> 30 hari
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12px] text-ink-2">
                {summary.market.name}
                {summary.latestObservedOn === null
                  ? ''
                  : `, data per ${formatDateWib(summary.latestObservedOn, 'long')}`}
                .
              </p>
            </section>
          )}

          <div className="mt-8 flex flex-wrap justify-between gap-3">
            <Button href="/edukasi" variant="secondary">
              Semua topik edukasi
            </Button>
            {next === undefined ? null : (
              <Button href={hrefs.article(next.slug)} arrow>
                Berikutnya: {next.title}
              </Button>
            )}
          </div>
        </article>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-28 lg:self-start">
          {toc.length === 0 ? null : (
            <nav
              aria-label="Di halaman ini"
              className="rounded-xl border border-line bg-surface p-5"
            >
              <p className="text-overline-11 text-muted-text uppercase">Di halaman ini</p>
              <ul className="mt-2 flex flex-col">
                {toc.map((h) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      className="block py-1.5 text-body-small-13 text-ink-2 hover:text-green-900"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <KataKapa
            pose="menunjuk"
            title="Coba cek harga hari ini."
            body="Lihat langsung bagaimana harga cabai, bawang merah, dan beras bergerak."
            action={
              <Button href="/harga" variant="ghost" size="S" arrow>
                Buka harga komoditas
              </Button>
            }
          />
          <section className="rounded-xl bg-terong-100 p-5">
            <h2 className="text-heading-card-16">Kenalan dengan ARIF-Net</h2>
            <p className="mt-1 text-body-small-13 text-ink-2">
              Model di balik prediksi Kawan Pasar, dan cara membacanya.
            </p>
            <Button href="/arif-net" variant="ghost" size="S" arrow>
              Kenali ARIF-Net
            </Button>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
