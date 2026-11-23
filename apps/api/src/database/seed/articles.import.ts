import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { createDb } from '../client.js';
import type { Db } from '../client.js';
import { parseArticleFile } from './article-file.js';

export const CONTENT_DIR = fileURLToPath(
  new URL('../../../../../content/articles/', import.meta.url),
);

/**
 * One-time import of `content/articles/*.md` into an EMPTY articles table (Fase 3B, K1). After
 * that the admin editor owns the articles: running it again changes nothing (`refused`), so a
 * web edit is never overwritten by a file. Each article is stored as its revision 1. All files
 * are parsed before anything is written, so one bad file aborts the whole import.
 */
export async function importArticles(
  db: Db,
  dir: string = CONTENT_DIR,
): Promise<{ imported: number; refused: boolean }> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.md')).sort();
  const articles = await Promise.all(
    names.map(async (n) => parseArticleFile(await readFile(path.join(dir, n), 'utf8'), n)),
  );
  return db.transaction(async (tx) => {
    // Locks out a concurrent import or a first save from the editor while this one runs.
    await tx.execute(sql`LOCK TABLE articles IN SHARE ROW EXCLUSIVE MODE`);
    const existing = await tx.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM articles`);
    if ((existing.rows[0]?.n ?? 0) > 0) return { imported: 0, refused: true };
    for (const a of articles) {
      const published = a.status === 'published';
      await tx.execute(sql`
        WITH inserted AS (
          INSERT INTO articles (slug, category, title, summary, body_md, reading_minutes,
                                sort_order, published_at, updated_at, revision)
          VALUES (${a.slug}, ${a.category}, ${a.title}, ${a.summary}, ${a.bodyMd},
                  ${a.readingMinutes}, ${a.order}, CASE WHEN ${published} THEN now() END, now(), 1)
          RETURNING id, category, title, summary, body_md, reading_minutes
        )
        INSERT INTO article_revisions (article_id, revision, category, title, summary, body_md,
                                       reading_minutes)
        SELECT id, 1, category, title, summary, body_md, reading_minutes FROM inserted`);
    }
    return { imported: articles.length, refused: false };
  });
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_MIGRATION_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATION_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const r = await importArticles(createDb(pool));
    process.stdout.write(
      r.refused
        ? 'articles already exist: nothing imported (edit them in /admin)\n'
        : `articles imported: ${String(r.imported)}\n`,
    );
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
