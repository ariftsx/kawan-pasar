import { Writable } from 'node:stream';
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
const logLines: string[] = [];

async function confirmedAdmin(): Promise<Account> {
  const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
  await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password: PASSWORD } });
  return ad;
}

const search = (ad: Account, email: string) =>
  call(app, 'POST', '/v1/admin/users/search', { ...ad, body: { email } });
const revoke = (ad: Account, id: string) =>
  call(app, 'POST', `/v1/admin/users/${id}/revoke-analyst`, ad);

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  const env = testEnv({ LOG_LEVEL: 'info' });
  app = await startApp({
    env,
    logDestination: new Writable({
      write(chunk: Buffer, _enc, done) {
        logLines.push(chunk.toString('utf8'));
        done();
      },
    }),
  });
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

describe('users in admin (Fase 3B task 4)', () => {
  it('finds one account by its exact e-mail only (no prefix search), masked', async () => {
    const a = await account(app, mail, owner, 'sari.wulandari@contoh.id', { role: 'analyst' });
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    expect((await search(ad, 'SARI.wulandari@contoh.id')).json()).toEqual({
      user: {
        id: a.id,
        email: 's***@contoh.id',
        role: 'analyst',
        emailVerified: true,
        createdAt: expect.any(String) as string,
      },
    });
    expect((await search(ad, 'sari')).status).toBe(400);
    expect((await search(ad, 'sari@contoh.id')).json()).toEqual({ user: null });
    // The searched address never reaches the logs.
    expect(logLines.join('')).not.toContain('wulandari');
  });

  it('revokes the analyst role (confirmed), audited; the next download is refused', async () => {
    const a = await account(app, mail, owner, 'sari@contoh.id', { role: 'analyst' });
    const ad = await confirmedAdmin();
    expect((await call(app, 'GET', '/v1/analyst/export/prices.csv', a)).status).toBe(200);
    expect((await revoke(ad, a.id)).status).toBe(204);
    expect((await call(app, 'GET', '/v1/analyst/export/prices.csv', a)).status).toBe(403);
    const audit = await owner.query<{ action: string; target: string }>(
      "SELECT action, target FROM audit_log WHERE action = 'role_revoke'",
    );
    expect(audit.rows).toEqual([{ action: 'role_revoke', target: `user:${a.id}` }]);
    // Already a plain user: nothing to revoke.
    expect((await revoke(ad, a.id)).json()).toMatchObject({
      error: { code: 'conflict', fields: ['role'] },
    });
  });

  it('never changes itself or another admin, and needs a confirmation', async () => {
    const other = await account(app, mail, owner, 'admin2@contoh.id', { role: 'admin' });
    const ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
    const a = await account(app, mail, owner, 'sari@contoh.id', { role: 'analyst' });
    expect((await revoke(ad, a.id)).json()).toMatchObject({ error: { code: 'reauth_required' } });
    await call(app, 'POST', '/v1/admin/confirm', { ...ad, body: { password: PASSWORD } });
    expect((await revoke(ad, ad.id)).status).toBe(403);
    expect((await revoke(ad, other.id)).status).toBe(403);
    expect((await revoke(ad, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await revoke(ad, 'bukan-uuid')).status).toBe(400);
  });
});
