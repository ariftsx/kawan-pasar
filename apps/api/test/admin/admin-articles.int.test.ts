import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { PASSWORD, account, call } from '../helpers/accounts.js';
import type { Account } from '../helpers/accounts.js';
import { startApp, testEnv } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

let app: NestFastifyApplication;
let owner: pg.Pool;
let connection: Redis;
let mail: Queue<MailJob>;
let sessions: Redis;
let cache: Redis;
let ad: Account;

const DRAFT = {
  slug: 'harga-cabai-musim-hujan',
  category: 'dasar',
  title: 'Harga cabai di musim hujan',
  summary: 'Mengapa harga cabai sering naik saat musim hujan.',
  bodyMd: '## Pasokan\n\nHujan mengganggu panen. Lihat [harga](/harga/cabai-merah-keriting).',
};

const get = (url: string) => call(app, 'GET', url, ad);
const send = (method: 'POST' | 'PUT', url: string, body?: unknown) =>
  call(app, method, url, { ...ad, ...(body === undefined ? {} : { body }) });
const publicGet = (url: string) => call(app, 'GET', url);

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  // A team domain added next to the defaults (K2).
  const env = testEnv({
    ARTICLE_IMAGE_ORIGINS: 'https://upload.wikimedia.org,https://cdn.tim.example',
  });
  app = await startApp({ env });
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mail = new Queue<MailJob>(MAIL_QUEUE, { connection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
  cache = new Redis(env.VALKEY_CACHE_URL);
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM articles');
  await owner.query('DELETE FROM audit_log');
  await mail.obliterate({ force: true });
  await sessions.flushdb();
  await cache.flushdb();
  ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
  await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password: PASSWORD } });
});

afterAll(async () => {
  await mail.close();
  connection.disconnect();
  sessions.disconnect();
  cache.disconnect();
  await app.close();
  await owner.end();
});

describe('articles in admin (Fase 3B task 6)', () => {
  it('creates a draft as revision 1, audited; a taken slug is a conflict', async () => {
    expect((await send('POST', '/v1/admin/articles', DRAFT)).status).toBe(201);
    const a = (await get(`/v1/admin/articles/${DRAFT.slug}`)).json();
    expect(a).toMatchObject({
      slug: DRAFT.slug,
      title: DRAFT.title,
      bodyMd: DRAFT.bodyMd,
      revision: 1,
      published: false,
      readingMinutes: 1,
      revisions: [{ revision: 1, by: 'a***@contoh.id' }],
    });
    expect((await get('/v1/admin/articles')).json()).toEqual({
      items: [expect.objectContaining({ slug: DRAFT.slug, status: 'draft', revision: 1 })],
    });
    const again = await send('POST', '/v1/admin/articles', DRAFT);
    expect(again.json()).toMatchObject({ error: { code: 'conflict', fields: ['slug'] } });
    const audit = await owner.query<{ action: string; target: string }>(
      'SELECT action, target FROM audit_log WHERE action = $1',
      ['article_save'],
    );
    expect(audit.rows).toEqual([{ action: 'article_save', target: `article:${DRAFT.slug}` }]);
  });

  it('refuses unsafe bodies and bad fields by name', async () => {
    const bad = await send('POST', '/v1/admin/articles', {
      ...DRAFT,
      bodyMd: '[klik](javascript:alert(1)) ![Foto](https://evil.example/a.jpg)',
    });
    expect(bad.status).toBe(400);
    expect(bad.json()).toMatchObject({ error: { fields: ['link', 'image_origin'] } });
    expect(
      (await send('POST', '/v1/admin/articles', { ...DRAFT, slug: 'Bukan Slug' })).json(),
    ).toMatchObject({
      error: { fields: ['slug'] },
    });
    // Images from a configured origin are fine (team domain from ARTICLE_IMAGE_ORIGINS).
    const ok = await send('POST', '/v1/admin/articles', {
      ...DRAFT,
      bodyMd: '![Cabai di pasar](https://cdn.tim.example/cabai.jpg)',
    });
    expect(ok.status).toBe(201);
  });

  it('saves against the revision it edited; a stale save is refused and changes nothing', async () => {
    await send('POST', '/v1/admin/articles', DRAFT);
    const edit = {
      category: 'dasar',
      title: 'Judul baru',
      summary: DRAFT.summary,
      bodyMd: 'Isi baru.',
    };
    const saved = await send('PUT', `/v1/admin/articles/${DRAFT.slug}`, {
      ...edit,
      baseRevision: 1,
    });
    expect(saved.json()).toEqual({ revision: 2 });
    const stale = await send('PUT', `/v1/admin/articles/${DRAFT.slug}`, {
      ...edit,
      title: 'Ditimpa?',
      baseRevision: 1,
    });
    expect(stale.json()).toMatchObject({ error: { code: 'conflict', fields: ['revision'] } });
    const a = (await get(`/v1/admin/articles/${DRAFT.slug}`)).json();
    expect(a).toMatchObject({ title: 'Judul baru', revision: 2 });
    expect((a['revisions'] as unknown[]).length).toBe(2);
  });

  it('publish shows it on the public API at once; unpublish hides it again', async () => {
    await send('POST', '/v1/admin/articles', DRAFT);
    expect((await publicGet(`/v1/articles/${DRAFT.slug}`)).status).toBe(404);
    expect((await send('POST', `/v1/admin/articles/${DRAFT.slug}/publish`)).status).toBe(204);
    // The API cache was dropped: no stale 404 from before.
    expect((await publicGet(`/v1/articles/${DRAFT.slug}`)).status).toBe(200);
    expect((await get('/v1/admin/articles')).json()).toEqual({
      items: [expect.objectContaining({ status: 'published' })],
    });
    expect((await send('POST', `/v1/admin/articles/${DRAFT.slug}/unpublish`)).status).toBe(204);
    expect((await publicGet(`/v1/articles/${DRAFT.slug}`)).status).toBe(404);
    const audit = await owner.query<{ action: string }>(
      "SELECT action FROM audit_log WHERE action IN ('article_publish', 'article_unpublish') ORDER BY id",
    );
    expect(audit.rows.map((r) => r.action)).toEqual(['article_publish', 'article_unpublish']);
  });

  it('restores an old revision as a new save', async () => {
    await send('POST', '/v1/admin/articles', DRAFT);
    await send('PUT', `/v1/admin/articles/${DRAFT.slug}`, {
      category: 'dasar',
      title: 'Judul yang salah',
      summary: DRAFT.summary,
      bodyMd: 'Isi yang salah.',
      baseRevision: 1,
    });
    const restored = await send('POST', `/v1/admin/articles/${DRAFT.slug}/restore`, {
      revision: 1,
      baseRevision: 2,
    });
    expect(restored.json()).toEqual({ revision: 3 });
    expect((await get(`/v1/admin/articles/${DRAFT.slug}`)).json()).toMatchObject({
      title: DRAFT.title,
      bodyMd: DRAFT.bodyMd,
      revision: 3,
    });
    expect(
      (
        await send('POST', `/v1/admin/articles/${DRAFT.slug}/restore`, {
          revision: 9,
          baseRevision: 3,
        })
      ).status,
    ).toBe(404);
  });

  it('a restored revision is checked like a new save (review finding)', async () => {
    await send('POST', '/v1/admin/articles', DRAFT);
    // Older content that today's rules refuse (e.g. imported, or saved before an origin change).
    await owner.query(
      `INSERT INTO article_revisions (article_id, revision, category, title, summary, body_md, reading_minutes)
       SELECT id, 9, category, title, summary, '[lama](http://contoh.id)', 1 FROM articles WHERE slug = $1`,
      [DRAFT.slug],
    );
    const res = await send('POST', `/v1/admin/articles/${DRAFT.slug}/restore`, {
      revision: 9,
      baseRevision: 1,
    });
    expect(res.status).toBe(400);
    expect(res.json()).toMatchObject({ error: { fields: ['link'] } });
    expect((await get(`/v1/admin/articles/${DRAFT.slug}`)).json()).toMatchObject({
      bodyMd: DRAFT.bodyMd,
      revision: 1,
    });
  });

  it('every change needs a recent confirmation; reading does not; unknown slug is 404', async () => {
    const fresh = await account(app, mail, owner, 'admin2@contoh.id', { role: 'admin' });
    const r = await call(app, 'POST', '/v1/admin/articles', { ...fresh, body: DRAFT });
    expect(r.json()).toMatchObject({ error: { code: 'reauth_required' } });
    expect((await call(app, 'GET', '/v1/admin/articles', fresh)).status).toBe(200);
    expect((await get('/v1/admin/articles/tidak-ada')).status).toBe(404);
    // The app role cannot rewrite history.
    await send('POST', '/v1/admin/articles', DRAFT);
    const appPool = poolFor('app');
    try {
      await expect(appPool.query('DELETE FROM article_revisions')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(appPool.query("UPDATE article_revisions SET title = 'x'")).rejects.toMatchObject(
        {
          code: '42501',
        },
      );
    } finally {
      await appPool.end();
    }
  });
});
