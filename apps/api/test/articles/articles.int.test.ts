import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ArticleSchema, ArticlesResponseSchema } from '@kawan-pasar/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { importArticles } from '../../src/database/seed/articles.import.js';
import { serviceToken, startApp } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const file = (slug: string, status: string, order: number, category = 'dasar'): string => `---
slug: ${slug}
category: ${category}
title: Judul ${slug}
summary: Ringkasan ${slug}.
readingMinutes: 4
status: ${status}
order: ${String(order)}
---

Isi ${slug}.
`;

let dir: string;
let owner: pg.Pool;
let app: NestFastifyApplication;
const redis = new Redis(process.env['VALKEY_CACHE_URL'] ?? '');

const get = (url: string) =>
  app.inject({ method: 'GET', url, headers: { 'x-service-token': serviceToken() } });

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  dir = await mkdtemp(path.join(tmpdir(), 'kp-articles-'));
  await writeFile(path.join(dir, 'b.md'), file('pola-musiman', 'published', 2));
  await writeFile(path.join(dir, 'a.md'), file('apa-itu-inflasi', 'published', 1));
  await writeFile(path.join(dir, 'c.md'), file('draf-anggaran', 'draft', 3, 'prediksi'));
  await importArticles(createDb(owner), dir);
  app = await startApp();
});

beforeEach(async () => {
  const keys = [
    ...(await redis.keys('kp:v1:articles:*')),
    ...(await redis.keys('kp:v1:json:articles:*')),
  ];
  if (keys.length > 0) await redis.del(...keys);
});

afterAll(async () => {
  await app.close();
  await owner.end();
  redis.disconnect();
});

describe('importArticles (Fase 3B K1: one-time import, the web editor owns articles after)', () => {
  it('refuses to run again once articles exist, so web edits are never overwritten', async () => {
    await owner.query(
      "UPDATE articles SET title = 'Disunting di web' WHERE slug = 'apa-itu-inflasi'",
    );
    expect(await importArticles(createDb(owner), dir)).toEqual({ imported: 0, refused: true });
    const res = await owner.query<{ title: string; n: number }>(
      "SELECT title, (SELECT count(*)::int FROM articles) AS n FROM articles WHERE slug = 'apa-itu-inflasi'",
    );
    expect(res.rows).toEqual([{ title: 'Disunting di web', n: 3 }]);
    await owner.query(
      "UPDATE articles SET title = 'Judul apa-itu-inflasi' WHERE slug = 'apa-itu-inflasi'",
    );
  });

  it('stores drafts without a publication time, and each article as revision 1', async () => {
    const res = await owner.query<{ published_at: Date | null; revision: number; revs: number }>(
      `SELECT a.published_at, a.revision,
              (SELECT count(*)::int FROM article_revisions r WHERE r.article_id = a.id AND r.revision = 1) AS revs
       FROM articles a WHERE slug = 'draf-anggaran'`,
    );
    expect(res.rows).toEqual([{ published_at: null, revision: 1, revs: 1 }]);
  });
});

describe('GET /v1/articles', () => {
  it('lists only published articles in their configured order', async () => {
    const body = ArticlesResponseSchema.parse((await get('/v1/articles')).json());
    expect(body.items.map((a) => a.slug)).toEqual(['apa-itu-inflasi', 'pola-musiman']);
  });

  it('filters by category', async () => {
    const body = ArticlesResponseSchema.parse((await get('/v1/articles?category=prediksi')).json());
    expect(body.items).toEqual([]);
  });

  it('rejects an unknown category by field name', async () => {
    const res = await get('/v1/articles?category=gosip');
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: { fields: ['category'] } });
  });
});

describe('GET /v1/articles/:slug', () => {
  it('returns a published article with its Markdown body', async () => {
    const body = ArticleSchema.parse((await get('/v1/articles/apa-itu-inflasi')).json());
    expect(body.bodyMd.trim()).toBe('Isi apa-itu-inflasi.');
  });

  it('hides drafts', async () => {
    expect((await get('/v1/articles/draf-anggaran')).statusCode).toBe(404);
  });

  it('answers malformed slugs with a 404 that does not echo the input', async () => {
    const res = await get('/v1/articles/%2E%2E%2Fetc%2Fpasswd');
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('passwd');
  });
});
