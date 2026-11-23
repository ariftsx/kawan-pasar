import { asc, desc, eq, sql } from 'drizzle-orm';
import { UNIQUE_VIOLATION, pgCode } from '../../common/pg-errors.js';
import type { Db } from '../../database/client.js';
import { articleRevisions, articles, auditLog, users } from '../../database/schema/index.js';

type Category = (typeof articles.$inferSelect)['category'];

export interface ArticleContent {
  category: Category;
  title: string;
  summary: string;
  bodyMd: string;
  readingMinutes: number;
}

export interface ArticleDetail extends ArticleContent {
  slug: string;
  revision: number;
  publishedAt: Date | null;
  updatedAt: Date;
  revisions: { revision: number; createdAt: Date; email: string | null }[];
}

export type SaveResult =
  | { ok: true; revision: number }
  | { ok: false; why: SaveRefusal }
  | { ok: false; why: 'invalid'; problems: readonly string[] };
export type SaveRefusal = 'not_found' | 'revision' | 'slug' | 'no_revision';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/**
 * Articles in the admin editor (Fase 3B task 6). Every save is a new revision and is audited in
 * the same transaction; a save names the revision it edited, and the article row is locked, so
 * two admins can never silently overwrite each other.
 */
export class AdminArticlesRepository {
  constructor(private readonly db: Db) {}

  async list(): Promise<
    {
      slug: string;
      title: string;
      category: Category;
      publishedAt: Date | null;
      revision: number;
      updatedAt: Date;
    }[]
  > {
    return this.db
      .select({
        slug: articles.slug,
        title: articles.title,
        category: articles.category,
        publishedAt: articles.publishedAt,
        revision: articles.revision,
        updatedAt: articles.updatedAt,
      })
      .from(articles)
      .orderBy(asc(articles.sortOrder), asc(articles.slug));
  }

  async get(slug: string): Promise<ArticleDetail | null> {
    const rows = await this.db.select().from(articles).where(eq(articles.slug, slug));
    const a = rows[0];
    if (a === undefined) return null;
    const revisions = await this.db
      .select({
        revision: articleRevisions.revision,
        createdAt: articleRevisions.createdAt,
        email: users.email,
      })
      .from(articleRevisions)
      .leftJoin(users, eq(users.id, articleRevisions.createdBy))
      .where(eq(articleRevisions.articleId, a.id))
      .orderBy(desc(articleRevisions.revision))
      .limit(50);
    return {
      slug: a.slug,
      category: a.category,
      title: a.title,
      summary: a.summary,
      bodyMd: a.bodyMd,
      readingMinutes: a.readingMinutes,
      revision: a.revision,
      publishedAt: a.publishedAt,
      updatedAt: a.updatedAt,
      revisions,
    };
  }

  /** A new draft, last in the education order, as revision 1. */
  async create(slug: string, content: ArticleContent, actorId: string): Promise<SaveResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const inserted = await tx
          .insert(articles)
          .values({
            slug,
            ...content,
            sortOrder: sql`(SELECT coalesce(max(sort_order), 0) + 1 FROM articles)`,
            revision: 1,
            updatedBy: actorId,
          })
          .returning({ id: articles.id });
        const id = inserted[0]?.id;
        if (id === undefined) return { ok: false, why: 'slug' };
        await this.record(tx, id, 1, content, actorId, 'article_save', slug);
        return { ok: true, revision: 1 };
      });
    } catch (e) {
      if (pgCode(e) === UNIQUE_VIOLATION) return { ok: false, why: 'slug' };
      throw e;
    }
  }

  async update(
    slug: string,
    content: ArticleContent,
    baseRevision: number,
    actorId: string,
  ): Promise<SaveResult> {
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, slug);
      if (current === null) return { ok: false, why: 'not_found' };
      if (current.revision !== baseRevision) return { ok: false, why: 'revision' };
      return this.write(
        tx,
        current.id,
        current.revision + 1,
        content,
        actorId,
        'article_save',
        slug,
      );
    });
  }

  /**
   * Copies an old revision back as a new save (nothing is ever rewritten). The old body is checked
   * with today's rules first (`problems`): it may predate them (import, an origin removed since).
   */
  async restore(
    slug: string,
    revision: number,
    baseRevision: number,
    actorId: string,
    problems: (bodyMd: string) => readonly string[],
  ): Promise<SaveResult> {
    return this.db.transaction(async (tx) => {
      const current = await this.lock(tx, slug);
      if (current === null) return { ok: false, why: 'not_found' };
      if (current.revision !== baseRevision) return { ok: false, why: 'revision' };
      const old = await tx
        .select({
          category: articleRevisions.category,
          title: articleRevisions.title,
          summary: articleRevisions.summary,
          bodyMd: articleRevisions.bodyMd,
          readingMinutes: articleRevisions.readingMinutes,
        })
        .from(articleRevisions)
        .where(
          sql`${articleRevisions.articleId} = ${current.id} AND ${articleRevisions.revision} = ${revision}`,
        );
      const content = old[0];
      if (content === undefined) return { ok: false, why: 'no_revision' };
      const found = problems(content.bodyMd);
      if (found.length > 0) return { ok: false, why: 'invalid', problems: found };
      return this.write(
        tx,
        current.id,
        current.revision + 1,
        content,
        actorId,
        'article_restore',
        slug,
      );
    });
  }

  /** Publish (first time or again: published now) or withdraw (hidden, back to draft). */
  async setPublished(slug: string, publish: boolean, actorId: string): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .update(articles)
        .set({
          publishedAt: publish ? sql`coalesce(${articles.publishedAt}, now())` : null,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .where(eq(articles.slug, slug))
        .returning({ id: articles.id });
      if (updated.length === 0) return false;
      await tx.insert(auditLog).values({
        actorId,
        action: publish ? 'article_publish' : 'article_unpublish',
        target: `article:${slug}`,
      });
      return true;
    });
  }

  private async lock(tx: Tx, slug: string): Promise<{ id: number; revision: number } | null> {
    const rows = await tx
      .select({ id: articles.id, revision: articles.revision })
      .from(articles)
      .where(eq(articles.slug, slug))
      .for('update');
    return rows[0] ?? null;
  }

  private async write(
    tx: Tx,
    id: number,
    revision: number,
    content: ArticleContent,
    actorId: string,
    action: 'article_save' | 'article_restore',
    slug: string,
  ): Promise<SaveResult> {
    await tx
      .update(articles)
      .set({ ...content, revision, updatedAt: new Date(), updatedBy: actorId })
      .where(eq(articles.id, id));
    await this.record(tx, id, revision, content, actorId, action, slug);
    return { ok: true, revision };
  }

  private async record(
    tx: Tx,
    articleId: number,
    revision: number,
    content: ArticleContent,
    actorId: string,
    action: 'article_save' | 'article_restore',
    slug: string,
  ): Promise<void> {
    await tx
      .insert(articleRevisions)
      .values({ articleId, revision, ...content, createdBy: actorId });
    await tx.insert(auditLog).values({ actorId, action, target: `article:${slug}` });
  }
}
