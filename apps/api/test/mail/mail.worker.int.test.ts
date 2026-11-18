import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { startMailWorker } from '../../src/modules/mail/mail.worker.js';
import { resolveForgot } from '../../src/modules/mail/forgot.js';
import { createDb } from '../../src/database/client.js';
import { AuthTokenService } from '../../src/modules/auth/auth-token.service.js';
import { UsersRepository } from '../../src/modules/auth/users.repository.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';
import type pg from 'pg';
import type { MailWorker } from '../../src/modules/mail/mail.worker.js';

const QUEUE_URL = process.env['VALKEY_QUEUE_URL'] ?? '';
const SMTP_URL = process.env['SMTP_URL'] ?? '';
const MAILPIT = process.env['MAILPIT_API_URL'] ?? '';
const SITE = 'http://127.0.0.1:8080';

let connection: Redis;
let queue: Queue<MailJob>;
let events: QueueEvents;
let worker: MailWorker | undefined;
let pool: pg.Pool;

interface MailpitSummary {
  ID: string;
  Subject: string;
}

async function inbox(to: string): Promise<MailpitSummary[]> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
  const body = (await res.json()) as { messages: MailpitSummary[] };
  return body.messages;
}

async function waitFor<T>(fn: () => Promise<T | undefined>, ms = 10_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await fn();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error('timed out');
    await delay(100);
  }
}

beforeAll(async () => {
  await resetTestDatabase();
  pool = poolFor('app');
  connection = new Redis(QUEUE_URL, { maxRetriesPerRequest: null });
  queue = new Queue<MailJob>(MAIL_QUEUE, { connection });
  events = new QueueEvents(MAIL_QUEUE, { connection: { url: QUEUE_URL } });
});

beforeEach(async () => {
  await worker?.close();
  worker = undefined;
  await queue.obliterate({ force: true });
});

afterAll(async () => {
  await worker?.close();
  await events.close();
  await queue.close();
  connection.disconnect();
  await pool.end();
});

describe('mail worker', () => {
  it('delivers a queued verification e-mail over SMTP with the link', async () => {
    worker = startMailWorker({
      queueUrl: QUEUE_URL,
      smtpUrl: SMTP_URL,
      from: 'Kawan Pasar <no-reply@kawanpasar.local>',
      siteUrl: SITE,
      log: () => undefined,
    });
    const to = `uji-${randomUUID()}@contoh.id`;
    const token = 'T'.repeat(43);
    await queue.add('verify_email', { template: 'verify_email', to, token });

    const [message] = await waitFor(async () => {
      const found = await inbox(to);
      return found.length > 0 ? found : undefined;
    });
    expect(message?.Subject).toBe('Verifikasi email akun Kawan Pasar Anda');
    const full = (await (await fetch(`${MAILPIT}/api/v1/message/${message?.ID ?? ''}`)).json()) as {
      Text: string;
      From: { Address: string };
    };
    expect(full.Text).toContain(`${SITE}/verifikasi-email?t=${token}`);
    expect(full.From.Address).toBe('no-reply@kawanpasar.local');
  });

  it('resolves a forgot-password job: a reset e-mail for a known address, nothing otherwise', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, '$argon2id$x') RETURNING id`,
      [`dikenal-${randomUUID()}@contoh.id`],
    );
    const known =
      (await pool.query<{ email: string }>('SELECT email FROM users WHERE id = $1', [rows[0]?.id]))
        .rows[0]?.email ?? '';
    const unknown = `asing-${randomUUID()}@contoh.id`;
    worker = startMailWorker({
      queueUrl: QUEUE_URL,
      smtpUrl: SMTP_URL,
      from: 'Kawan Pasar <no-reply@kawanpasar.local>',
      siteUrl: SITE,
      log: () => undefined,
      resolve: (job) =>
        resolveForgot(job, {
          users: new UsersRepository(createDb(pool), 'a'.repeat(43)),
          tokens: new AuthTokenService(createDb(pool), { now: () => new Date() }),
          now: () => new Date(),
        }),
    });
    const a = await queue.add('forgot_password', {
      template: 'forgot_password',
      to: known,
      ip: '10.0.0.1',
    });
    const b = await queue.add('forgot_password', {
      template: 'forgot_password',
      to: unknown,
      ip: '10.0.0.1',
    });
    await a.waitUntilFinished(events, 10_000);
    await b.waitUntilFinished(events, 10_000);
    const [mail] = await waitFor(async () => {
      const found = await inbox(known);
      return found.length > 0 ? found : undefined;
    });
    expect(mail?.Subject).toBe('Atur ulang kata sandi Kawan Pasar');
    expect(await inbox(unknown)).toEqual([]);
  });

  it('a no-op job completes without sending anything', async () => {
    worker = startMailWorker({
      queueUrl: QUEUE_URL,
      smtpUrl: SMTP_URL,
      from: 'Kawan Pasar <no-reply@kawanpasar.local>',
      siteUrl: SITE,
      log: () => undefined,
    });
    const job = await queue.add('noop', { template: 'noop' });
    await job.waitUntilFinished(events, 10_000);
    expect(await job.getState()).toBe('completed');
  });

  it('retries when the mail server is down, and logs no address or token', async () => {
    const lines: string[] = [];
    worker = startMailWorker({
      queueUrl: QUEUE_URL,
      smtpUrl: 'smtp://127.0.0.1:1',
      from: 'Kawan Pasar <no-reply@kawanpasar.local>',
      siteUrl: SITE,
      log: (line) => lines.push(line),
    });
    const to = `gagal-${randomUUID()}@contoh.id`;
    const token = 'R'.repeat(43);
    const job = await queue.add(
      'reset_password',
      { template: 'reset_password', to, token },
      { attempts: 2, backoff: { type: 'fixed', delay: 100 } },
    );
    await expect(job.waitUntilFinished(events, 15_000)).rejects.toThrow();
    expect((await queue.getJob(job.id ?? ''))?.attemptsMade).toBe(2);
    expect(lines.length).toBeGreaterThan(0);
    const all = lines.join('\n');
    expect(all).not.toContain(to);
    expect(all).not.toContain(token);
  });
});
