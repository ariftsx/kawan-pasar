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
 * Upserts every `*.md` article by slug. A published article keeps its first `published_at`;
 * switching it back to draft clears it (hidden again). All files are parsed before anything is
 * written, so one bad file aborts the whole seed.
 */
export async function seedArticles(db: Db, dir: string = CONTENT_DIR): Promise<number> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.md')).sort();
  const articles = await Promise.all(
    names.map(async (n) => parseArticleFile(await readFile(path.join(dir, n), 'utf8'), n)),
  );

  await db.transaction(async (tx) => {
    for (const a of articles) {
      const published = a.status === 'published';
      await tx.execute(sql`
        INSERT INTO articles (slug, category, title, summary, body_md, reading_minutes, sort_order,
                              published_at, updated_at)
        VALUES (${a.slug}, ${a.category}, ${a.title}, ${a.summary}, ${a.bodyMd}, ${a.readingMinutes},
                ${a.order}, CASE WHEN ${published} THEN now() END, now())
        ON CONFLICT (slug) DO UPDATE SET
          category = excluded.category,
          title = excluded.title,
          summary = excluded.summary,
          body_md = excluded.body_md,
          reading_minutes = excluded.reading_minutes,
          sort_order = excluded.sort_order,
          published_at = CASE WHEN ${published} THEN COALESCE(articles.published_at, now()) END,
          updated_at = now()`);
    }
  });
  return articles.length;
}

async function main(): Promise<void> {
  const url = process.env['DATABASE_MIGRATION_URL'];
  if (url === undefined || url === '') throw new Error('DATABASE_MIGRATION_URL is not set');
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    const count = await seedArticles(createDb(pool));
    process.stdout.write(`articles seeded: ${String(count)}\n`);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
