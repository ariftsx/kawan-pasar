import type { Article, ArticleCategory, ArticleListItem } from '@kawan-pasar/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';

const ListRow = z.object({
  slug: z.string(),
  category: z.enum(['dasar', 'prediksi', 'arif-net', 'keterbatasan']),
  title: z.string(),
  summary: z.string(),
  reading_minutes: z.number().int(),
  published_at: z.coerce.date(),
});
const ItemRow = ListRow.extend({ body_md: z.string(), updated_at: z.coerce.date() });

const toListItem = (r: z.infer<typeof ListRow>): ArticleListItem => ({
  slug: r.slug,
  category: r.category,
  title: r.title,
  summary: r.summary,
  readingMinutes: r.reading_minutes,
  publishedAt: r.published_at.toISOString(),
});

@Injectable()
export class ArticlesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** Published articles only (drafts have no published_at). */
  async list(category: ArticleCategory | undefined): Promise<ArticleListItem[]> {
    const filter = category === undefined ? sql`` : sql`AND category = ${category}`;
    const result = await this.db.execute(sql`
      SELECT slug, category::text AS category, title, summary, reading_minutes, published_at
      FROM articles
      WHERE published_at IS NOT NULL ${filter}
      ORDER BY sort_order, slug`);
    return z.array(ListRow).parse(result.rows).map(toListItem);
  }

  async bySlug(slug: string): Promise<Article | null> {
    const result = await this.db.execute(sql`
      SELECT slug, category::text AS category, title, summary, reading_minutes, published_at,
             body_md, updated_at
      FROM articles WHERE slug = ${slug} AND published_at IS NOT NULL`);
    const row = z.array(ItemRow).parse(result.rows)[0];
    if (row === undefined) return null;
    return { ...toListItem(row), bodyMd: row.body_md, updatedAt: row.updated_at.toISOString() };
  }
}
