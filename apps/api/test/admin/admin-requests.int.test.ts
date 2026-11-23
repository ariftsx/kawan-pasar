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

const REASON = 'Skripsi tentang inflasi pangan Jakarta';

async function requester(email: string): Promise<Account & { requestId: number }> {
  const a = await account(app, mail, owner, email);
  await call(app, 'POST', '/v1/analyst/request', {
    ...a,
    body: { reason: REASON, organization: 'UMB' },
  });
  const r = await owner.query<{ id: string }>(
    'SELECT id FROM analyst_requests WHERE user_id = $1',
    [a.id],
  );
  return { ...a, requestId: Number(r.rows[0]?.id) };
}

async function confirmedAdmin(): Promise<Account> {
  const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
  await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password: PASSWORD } });
  return ad;
}

const decide = (ad: Account, id: number, body: unknown) =>
  call(app, 'POST', `/v1/admin/requests/${String(id)}/decision`, { ...ad, body });

async function mailsTo(email: string): Promise<MailJob[]> {
  const jobs = await mail.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active']);
  return jobs.map((j) => j.data).filter((d) => d.to === email);
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  const env = testEnv();
  app = await startApp({ env });
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mail = new Queue<MailJob>(MAIL_QUEUE, { connection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM audit_log');
  await mail.obliterate({ force: true });
  await sessions.flushdb();
});

afterAll(async () => {
  await mail.close();
  connection.disconnect();
  sessions.disconnect();
  await app.close();
  await owner.end();
});

describe('analyst requests in admin (Fase 3B task 3)', () => {
  it('lists pending requests with a masked e-mail, oldest first', async () => {
    await requester('sari.wulandari@contoh.id');
    await requester('budi@contoh.id');
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const list = (await call(app, 'GET', '/v1/admin/requests', ad)).json();
    expect(list['items']).toEqual([
      expect.objectContaining({ email: 's***@contoh.id', reason: REASON, organization: 'UMB' }),
      expect.objectContaining({ email: 'b***@contoh.id' }),
    ]);
    expect(JSON.stringify(list)).not.toContain('wulandari');
  });

  it('approve: role becomes analyst, news + e-mail, audit; a second decision is a conflict', async () => {
    const r = await requester('sari@contoh.id');
    const ad = await confirmedAdmin();
    expect((await decide(ad, r.requestId, { decision: 'approve' })).status).toBe(204);
    expect((await call(app, 'GET', '/v1/analyst', r)).json()).toMatchObject({
      role: 'analyst',
      request: { status: 'approved' },
    });
    const news = await owner.query<{ kind: string; link: string }>(
      'SELECT kind, link FROM notifications WHERE user_id = $1',
      [r.id],
    );
    expect(news.rows).toEqual([{ kind: 'role_decision', link: '/analis' }]);
    expect((await mailsTo('sari@contoh.id')).map((m) => m.template)).toContain('analyst_approved');
    const again = await decide(ad, r.requestId, { decision: 'reject', note: 'Terlambat' });
    expect(again.json()).toMatchObject({ error: { code: 'conflict', fields: ['decided'] } });
    const audit = await owner.query<{ action: string; actor_id: string; target: string }>(
      "SELECT action, actor_id, target FROM audit_log WHERE action = 'role_approve'",
    );
    expect(audit.rows).toEqual([
      { action: 'role_approve', actor_id: ad.id, target: `analyst_request:${String(r.requestId)}` },
    ]);
  });

  it('reject keeps the role, stores the note, tells the user, and allows a new request', async () => {
    const r = await requester('sari@contoh.id');
    const ad = await confirmedAdmin();
    const note = 'Mohon jelaskan kebutuhan data lebih rinci.';
    expect((await decide(ad, r.requestId, { decision: 'reject', note })).status).toBe(204);
    expect((await call(app, 'GET', '/v1/analyst', r)).json()).toEqual({
      role: 'user',
      request: { status: 'rejected', createdAt: expect.any(String) as string, note },
      canRequest: true,
    });
    const m = (await mailsTo('sari@contoh.id')).find((x) => x.template === 'analyst_rejected');
    expect(m?.lines).toEqual([note]);
    expect((await decide(ad, r.requestId, { decision: 'reject' })).status).toBe(409);
  });

  it('needs a recent password confirmation, valid input, and an existing request', async () => {
    const r = await requester('sari@contoh.id');
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const res = await decide(ad, r.requestId, { decision: 'approve' });
    expect(res.json()).toMatchObject({ error: { code: 'reauth_required' } });
    await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password: PASSWORD } });
    expect((await decide(ad, r.requestId, { decision: 'maybe' })).status).toBe(400);
    expect(
      (await decide(ad, r.requestId, { decision: 'reject', note: 'x'.repeat(501) })).status,
    ).toBe(400);
    expect((await decide(ad, 999_999, { decision: 'approve' })).status).toBe(404);
    // A plain user cannot decide anything.
    expect((await decide(r, r.requestId, { decision: 'approve' })).status).toBe(403);
  });

  it('an approval does not overwrite a role changed meanwhile (e.g. made admin by CLI)', async () => {
    const r = await requester('sari@contoh.id');
    const ad = await confirmedAdmin();
    await owner.query("UPDATE users SET role = 'admin' WHERE id = $1", [r.id]);
    expect((await decide(ad, r.requestId, { decision: 'approve' })).status).toBe(204);
    const role = await owner.query<{ role: string }>('SELECT role FROM users WHERE id = $1', [
      r.id,
    ]);
    expect(role.rows).toEqual([{ role: 'admin' }]);
  });
});
