import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { sendWeeklySummaries, weekStart } from '../../src/modules/alerts/weekly.js';
import { AuthTokenService } from '../../src/modules/auth/auth-token.service.js';
import type { MailJob, MailOutbox } from '../../src/modules/mail/mail.queue.js';
import { renderMail } from '../../src/modules/mail/templates.js';
import { loadObservations, weekdays } from '../helpers/fixtures.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA';
const MONDAY = new Date('2026-11-23T06:00:00+07:00');

let owner: pg.Pool;
let app: pg.Pool;
const sent: MailJob[] = [];
const outbox: MailOutbox = {
  send: (job) => {
    sent.push(job);
    return Promise.resolve();
  },
};

const deps = (): Parameters<typeof sendWeeklySummaries>[0] => {
  const db = createDb(app);
  return { db, tokens: new AuthTokenService(db, { now: () => MONDAY }), outbox };
};

async function subscriber(
  email: string,
  opts: { verified?: boolean; weekly?: boolean } = {},
): Promise<string> {
  const r = await owner.query<{ id: string }>(
    'INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, $3) RETURNING id',
    [email, HASH, opts.verified === false ? null : new Date()],
  );
  const id = r.rows[0]?.id ?? '';
  await owner.query('INSERT INTO alert_preferences (user_id, weekly) VALUES ($1, $2)', [
    id,
    opts.weekly ?? true,
  ]);
  await owner.query(
    `INSERT INTO alert_watches (user_id, market_id, commodity_id)
     SELECT $1, m.id, c.id FROM markets m, commodities c
     WHERE m.code = 'PIKJ' AND c.code IN ('bawang-merah', 'cabai-rawit-merah')`,
    [id],
  );
  return id;
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  app = poolFor('app');
  await loadObservations(owner, [
    ...weekdays('2026-09-01', '2026-09-29').map((d) => ({
      commodity: 'bawang-merah',
      date: d,
      price: 38_000,
    })),
    { commodity: 'bawang-merah', date: '2026-09-30', price: 40_300 },
  ]);
});

beforeEach(async () => {
  sent.length = 0;
  await owner.query('DELETE FROM users');
});

afterAll(async () => {
  await app.end();
  await owner.end();
});

describe('weekly summary', () => {
  it('the week starts on Monday in WIB', () => {
    expect(weekStart(new Date('2026-11-23T06:00:00+07:00'))).toBe('2026-11-23');
    expect(weekStart(new Date('2026-11-22T23:30:00+07:00'))).toBe('2026-11-16');
    expect(weekStart(new Date('2026-11-22T17:30:00Z'))).toBe('2026-11-23'); // 00.30 WIB Monday
  });

  it('writes one fact line per watched commodity with prices, in the app and by e-mail', async () => {
    const id = await subscriber('sari@contoh.id');
    expect(await sendWeeklySummaries(deps(), MONDAY)).toEqual({ users: 1, sent: 1 });
    const n = await owner.query(
      "SELECT title, body, link, to_char(data_date, 'YYYY-MM-DD') AS d FROM notifications WHERE user_id = $1",
      [id],
    );
    expect(n.rows[0]).toEqual({
      title: 'Ringkasan mingguan · 23 Nov 2026',
      body: 'Bawang merah: Rp 40.300/kg, naik 6,1% dalam 7 hari (data 30 Sep 2026).',
      link: '/peringatan',
      d: '2026-11-23',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ template: 'weekly_summary', to: 'sari@contoh.id' });
    const mail = renderMail(sent[0] ?? { template: 'noop' }, 'http://127.0.0.1:8080');
    expect(mail?.text).toContain('Bawang merah: Rp 40.300/kg');
    expect(mail?.text).toMatch(/\/berhenti-ringkasan\?t=[A-Za-z0-9_-]{43}/);
    expect(mail?.text).not.toContain('sari@contoh.id');
  });

  it('runs once per week even if the job is repeated', async () => {
    await subscriber('sari@contoh.id');
    await sendWeeklySummaries(deps(), MONDAY);
    expect(await sendWeeklySummaries(deps(), MONDAY)).toEqual({ users: 1, sent: 0 });
    expect(sent).toHaveLength(1);
  });

  it('skips accounts that are unverified or switched the summary off', async () => {
    await subscriber('baru@contoh.id', { verified: false });
    await subscriber('diam@contoh.id', { weekly: false });
    expect(await sendWeeklySummaries(deps(), MONDAY)).toEqual({ users: 0, sent: 0 });
  });

  it('the unsubscribe token belongs to the user and works once', async () => {
    const id = await subscriber('sari@contoh.id');
    await sendWeeklySummaries(deps(), MONDAY);
    const tokens = new AuthTokenService(createDb(app), { now: () => MONDAY });
    expect(await tokens.consume(sent[0]?.token ?? '', 'weekly_unsubscribe')).toBe(id);
    expect(await tokens.consume(sent[0]?.token ?? '', 'weekly_unsubscribe')).toBeNull();
  });
});

describe('weekly summary when e-mail queueing fails', () => {
  it('serves the others, fails the job, and a retry sends only the missed summary', async () => {
    await subscriber('sari@contoh.id');
    await subscriber('budi@contoh.id');
    let broken = true;
    const flaky: MailOutbox = {
      send: (job) => {
        if (broken && job.to === 'budi@contoh.id') return Promise.reject(new Error('valkey down'));
        sent.push(job);
        return Promise.resolve();
      },
    };
    const db = createDb(app);
    const run = (): ReturnType<typeof sendWeeklySummaries> =>
      sendWeeklySummaries(
        { db, tokens: new AuthTokenService(db, { now: () => MONDAY }), outbox: flaky },
        MONDAY,
      );
    await expect(run()).rejects.toMatchObject({ name: 'WeeklyPartialFailure', failed: 1, sent: 1 });
    expect(sent.map((m) => m.to)).toEqual(['sari@contoh.id']);
    broken = false;
    expect(await run()).toEqual({ users: 2, sent: 1 });
    expect(sent.map((m) => m.to).sort()).toEqual(['budi@contoh.id', 'sari@contoh.id']);
    const n = await owner.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE kind = 'weekly'",
    );
    expect(n.rows[0]?.n).toBe(2);
  });
});

describe('weekly summary when the WhatsApp hand-over fails (review 2C)', () => {
  it('the e-mail is sent once and the week is not undone', async () => {
    await subscriber('sari@contoh.id');
    const db = createDb(app);
    const r = await sendWeeklySummaries(
      {
        db,
        tokens: new AuthTokenService(db, { now: () => MONDAY }),
        outbox,
        onSent: () => Promise.reject(new Error('valkey down')),
      },
      MONDAY,
    ).catch((e: unknown) => e);
    // onSent failures are the caller's to swallow; the week row must stay either way.
    const n = await owner.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM notifications WHERE kind = 'weekly'",
    );
    expect(n.rows[0]?.n).toBe(1);
    expect(sent).toHaveLength(1);
    expect(r).toEqual({ users: 1, sent: 1 });
  });
});
