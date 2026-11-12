import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ArticleSchema, ArticlesResponseSchema } from '@kawan-pasar/contracts';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { seedArticles } from '../../src/database/seed/articles.seed.js';
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
  await seedArticles(createDb(owner), dir);
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

describe('seedArticles', () => {
  it('keeps the first publication time when seeded again', async () => {
    const before = await owner.query<{ published_at: Date }>(
      "SELECT published_at FROM articles WHERE slug = 'apa-itu-inflasi'",
    );
    await seedArticles(createDb(owner), dir);
    const after = await owner.query<{ published_at: Date; n: number }>(
      "SELECT published_at, (SELECT count(*)::int FROM articles) AS n FROM articles WHERE slug = 'apa-itu-inflasi'",
    );
    expect(after.rows[0]?.n).toBe(3);
    expect(after.rows[0]?.published_at.getTime()).toBe(before.rows[0]?.published_at.getTime());
  });

  it('stores drafts without a publication time', async () => {
    const res = await owner.query<{ published_at: Date | null }>(
      "SELECT published_at FROM articles WHERE slug = 'draf-anggaran'",
    );
    expect(res.rows[0]?.published_at).toBeNull();
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
