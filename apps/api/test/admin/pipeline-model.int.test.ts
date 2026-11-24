import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MAIL_QUEUE } from '../../src/modules/mail/mail.queue.js';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { PASSWORD, account, call } from '../helpers/accounts.js';
import type { Account } from '../helpers/accounts.js';
import { fullRows, writeBundle } from '../helpers/bundles.js';
import { loadObservations } from '../helpers/fixtures.js';
import { fixedClock, serviceToken, startApp, testEnv } from '../helpers/test-app.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

const clock = fixedClock('2026-12-07T09:00:00+07:00');
const AIRFLOW_PASSWORD = 'a'.repeat(40);

// --- a fake Airflow REST API (the real one is exercised in the simulation, task 7) ---
interface Seen {
  method: string;
  path: string;
  body: unknown;
}
const seen: Seen[] = [];
const paused: Record<string, boolean> = { harga_harian: false, latih_ulang: false };
let airflow: Server;

/** Answers and returns true, so a handler can `return reply(...)`. */
function reply(res: ServerResponse, status: number, body: unknown): true {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
  return true;
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<true> {
  let raw = '';
  for await (const chunk of req) raw += String(chunk);
  const url = new URL(req.url ?? '/', 'http://x');
  const body: unknown = raw === '' ? null : JSON.parse(raw);
  seen.push({ method: req.method ?? '', path: url.pathname, body });
  const p = url.pathname;
  if (p === '/auth/token') return reply(res, 201, { access_token: 'h.e30.s' });
  if (req.headers.authorization !== 'Bearer h.e30.s') return reply(res, 401, {});
  const dag = /^\/api\/v2\/dags\/([a-z_]+)$/.exec(p);
  if (dag?.[1] !== undefined) {
    if (req.method === 'PATCH') paused[dag[1]] = (body as { is_paused: boolean }).is_paused;
    return reply(res, 200, { dag_id: dag[1], is_paused: paused[dag[1]] ?? false });
  }
  if (/^\/api\/v2\/dags\/[a-z_]+\/dagRuns$/.test(p)) {
    if (req.method === 'POST') {
      return reply(res, 200, {
        dag_run_id: `manual__${String(seen.length)}`,
        state: 'queued',
        run_type: 'manual',
      });
    }
    return reply(res, 200, {
      dag_runs: [
        {
          dag_run_id: 'scheduled__1',
          state: 'success',
          run_type: 'scheduled',
          run_after: '2026-12-07T03:00:00Z',
          start_date: '2026-12-07T03:00:01Z',
          end_date: '2026-12-07T03:00:09Z',
        },
      ],
    });
  }
  if (p.endsWith('/taskInstances')) {
    return reply(res, 200, {
      task_instances: [{ task_id: 'check_lock', state: 'skipped', duration: 1.4 }],
    });
  }
  if (p.endsWith('/xcomEntries/return_value')) {
    return reply(res, 200, {
      value: { open: false, data_ceiling: '2026-09-30', reason: 'OPENED.json belum ada' },
    });
  }
  return reply(res, 404, {});
}

let app: NestFastifyApplication;
let owner: pg.Pool;
let connection: Redis;
let mail: Queue<MailJob>;
let sessions: Redis;
let runsDir: string;
let ad: Account;

/** A candidate run folder with a real bundle, registered like the DAG does. */
async function candidate(o: {
  runId: string;
  bundleId: string;
  lockOpen: boolean;
  dataEnd: string;
  overall?: number;
  issuedAt?: string;
}): Promise<number> {
  const src = await writeBundle({
    bundleId: o.bundleId,
    issuedAt: o.issuedAt ?? '2026-12-07T03:00:00+07:00',
    rows: [...fullRows(), ...fullRows('cabai-rawit-hijau', 61_000)],
    modelName: 'arifnet',
  });
  const dir = path.join(runsDir, o.runId, 'out', 'bundles', o.bundleId);
  await cp(src, dir, { recursive: true });
  const sums = createHash('sha256')
    .update(await readFile(path.join(dir, 'SHA256SUMS')))
    .digest('hex');
  const res = await call(app, 'POST', '/internal/model-candidates', {
    body: {
      runId: o.runId,
      bundleId: o.bundleId,
      bundleSha256: sums,
      modelVersion: `arifnet-a0-kp-${o.runId}`,
      dataEnd: o.dataEnd,
      lockOpen: o.lockOpen,
      commodities: ['cabai-merah-keriting', 'cabai-rawit-hijau'],
      overallRelmae: o.overall ?? 0.87,
      scores: { 'cabai-merah-keriting': { '7': 0.98 } },
      window: { start: '2024-12-04', end: '2025-12-04' },
    },
  });
  expect(res.status).toBe(201);
  return (res.json() as { id: number }).id;
}

const confirm = async (a: Account): Promise<void> => {
  expect(
    (await call(app, 'POST', '/v1/admin/confirm', { ...a, body: { password: PASSWORD } })).status,
  ).toBe(204);
};

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  airflow = createServer((req, res) => {
    void handle(req, res);
  });
  await new Promise<void>((r) => airflow.listen(0, '127.0.0.1', r));
  const port = (airflow.address() as AddressInfo).port;
  runsDir = await mkdtemp(path.join(tmpdir(), 'kp-runs-'));
  const env = testEnv({
    AIRFLOW_API_URL: `http://127.0.0.1:${String(port)}`,
    AIRFLOW_API_PASSWORD: AIRFLOW_PASSWORD,
    PIPELINE_RUNS_DIR: runsDir,
  });
  app = await startApp({ env, clock });
  connection = new Redis(env.VALKEY_QUEUE_URL, { maxRetriesPerRequest: null });
  mail = new Queue<MailJob>(MAIL_QUEUE, { connection });
  sessions = new Redis(env.VALKEY_SESSION_URL);
  await owner.query('DELETE FROM users');
  await mail.obliterate({ force: true });
  await sessions.flushdb();
  ad = await account(app, mail, owner, 'admin@contoh.id', { role: 'admin' });
  await loadObservations(owner, [
    { commodity: 'cabai-merah-keriting', date: '2026-12-04', price: 52_400 },
    { commodity: 'cabai-rawit-hijau', date: '2026-12-04', price: 61_000 },
  ]);
});

beforeEach(() => {
  seen.length = 0;
});

afterAll(async () => {
  await mail.close();
  connection.disconnect();
  sessions.disconnect();
  await app.close();
  await owner.end();
  await new Promise<void>((r) => {
    airflow.close(() => {
      r();
    });
  });
});

describe('admin pipeline page (Fase 4C)', () => {
  it('shows the lock, the schedule, the quota and the recent runs from Airflow', async () => {
    const res = await call(app, 'GET', '/v1/admin/pipeline', ad);
    expect(res.status).toBe(200);
    expect(res.json()).toMatchObject({
      airflow: 'active',
      lock: { open: false, dataCeiling: '2026-09-30', reason: 'OPENED.json belum ada' },
      schedule: { preset: 'weekly_monday', next: '2026-12-07' },
      triggersToday: { used: 0, limit: 3 },
      dags: [
        { id: 'harga_harian', paused: false, runs: [{ runId: 'scheduled__1', state: 'success' }] },
        {
          id: 'latih_ulang',
          runs: [{ tasks: [{ id: 'check_lock', state: 'skipped', durationSeconds: 1 }] }],
        },
      ],
    });
    // Airflow is called as the service account, never with the admin's session.
    expect(seen[0]).toMatchObject({
      path: '/auth/token',
      body: { username: 'kawanpasar-api', password: AIRFLOW_PASSWORD },
    });
  });

  it('every action needs a recent password confirmation and is audited', async () => {
    const before = await call(app, 'PUT', '/v1/admin/pipeline/schedule', {
      ...ad,
      body: { preset: 'daily' },
    });
    expect(before.json()).toMatchObject({ error: { code: 'reauth_required' } });
    await confirm(ad);
    expect(
      (await call(app, 'PUT', '/v1/admin/pipeline/schedule', { ...ad, body: { preset: 'daily' } }))
        .status,
    ).toBe(204);
    // The DAG's schedule gate (service token) follows the admin's choice.
    const gate = await app.inject({
      method: 'GET',
      url: '/internal/pipeline/schedule',
      headers: { 'x-service-token': serviceToken() },
    });
    expect(gate.json()).toEqual({
      preset: 'daily',
      date: '2026-12-07',
      train: true,
      next: '2026-12-07',
    });
    expect(
      (await call(app, 'POST', '/v1/admin/pipeline/pause', { ...ad, body: { dag: 'latih_ulang' } }))
        .status,
    ).toBe(204);
    expect(paused['latih_ulang']).toBe(true);
    const audit = await owner.query<{ action: string; target: string }>(
      `SELECT action::text, target FROM audit_log WHERE action::text LIKE 'pipeline_%' ORDER BY id`,
    );
    expect(audit.rows).toEqual([
      { action: 'pipeline_schedule', target: 'daily' },
      { action: 'pipeline_pause', target: 'latih_ulang' },
    ]);
  });

  it('a manual retraining verifies even while locked, at most 3 a day', async () => {
    await confirm(ad);
    for (let i = 0; i < 3; i++) {
      const res = await call(app, 'POST', '/v1/admin/pipeline/trigger', {
        ...ad,
        body: { dag: 'latih_ulang' },
      });
      expect(res.status).toBe(202);
    }
    expect(seen.find((s) => s.method === 'POST' && s.path.endsWith('/dagRuns'))?.body).toEqual({
      logical_date: null,
      conf: { even_if_locked: true },
    });
    const fourth = await call(app, 'POST', '/v1/admin/pipeline/trigger', {
      ...ad,
      body: { dag: 'latih_ulang' },
    });
    expect(fourth.json()).toMatchObject({ error: { code: 'quota_exceeded' } });
    // status_kunci is internal: never triggered from the admin.
    expect(
      (
        await call(app, 'POST', '/v1/admin/pipeline/trigger', {
          ...ad,
          body: { dag: 'status_kunci' },
        })
      ).status,
    ).toBe(400);
  });

  it('other users cannot see or use the pipeline page', async () => {
    const u = await account(app, mail, owner, 'biasa@contoh.id');
    expect((await call(app, 'GET', '/v1/admin/pipeline', u)).status).toBe(403);
  });
});

describe('admin model audit (Fase 4C)', () => {
  it('a locked-run candidate can be audited but not approved; rejecting it does not retrain', async () => {
    const id = await candidate({
      runId: 'train-20261207T000000Z',
      bundleId: 'arifnet-locked-1',
      lockOpen: false,
      dataEnd: '2026-09-30',
    });
    const detail = (await call(app, 'GET', `/v1/admin/model-candidates/${String(id)}`, ad)).json();
    expect(detail).toMatchObject({
      audit: { runtime: { ok: true }, quality: { pass: true }, blockers: ['locked'] },
    });
    await confirm(ad);
    const approve = await call(app, 'POST', `/v1/admin/model-candidates/${String(id)}/approve`, ad);
    expect(approve.json()).toMatchObject({ error: { code: 'conflict', fields: ['locked'] } });
    const reject = await call(app, 'POST', `/v1/admin/model-candidates/${String(id)}/reject`, {
      ...ad,
      body: { note: 'Verifikasi sebelum pembukaan uji prospektif' },
    });
    expect(reject.json()).toEqual({ retrain: 'locked' });
    expect(seen.some((s) => s.method === 'POST' && s.path.endsWith('/dagRuns'))).toBe(false);
  });

  it('approving an open candidate activates its bundle: cabai rawit forecasts appear', async () => {
    const id = await candidate({
      runId: 'train-20261207T010000Z',
      bundleId: 'arifnet-open-1',
      lockOpen: true,
      dataEnd: '2026-12-04',
    });
    const detail = (await call(app, 'GET', `/v1/admin/model-candidates/${String(id)}`, ad)).json();
    expect(detail).toMatchObject({ audit: { blockers: [] } });
    expect((detail['audit'] as { samples: unknown[] }).samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commodity: 'cabai-rawit-hijau', basePriceIdr: 61_000 }),
      ]),
    );
    await confirm(ad);
    expect(
      (await call(app, 'POST', `/v1/admin/model-candidates/${String(id)}/approve`, ad)).status,
    ).toBe(204);
    const forecast = await call(
      app,
      'GET',
      '/v1/markets/PIKJ/commodities/cabai-rawit-hijau/forecast',
    );
    expect(forecast.json()).toMatchObject({
      status: 'available',
      commodity: { modelCoverage: 'covered' },
    });
    // The approved run keeps its folder; a second approval is refused.
    const keep = await app.inject({
      method: 'GET',
      url: '/internal/pipeline/keep-runs',
      headers: { 'x-service-token': serviceToken() },
    });
    expect(keep.json()).toEqual({ runIds: ['train-20261207T010000Z'] });
    const again = await call(app, 'POST', `/v1/admin/model-candidates/${String(id)}/approve`, ad);
    expect(again.json()).toMatchObject({ error: { fields: ['decided'] } });
  });

  it('rejecting an open candidate retrains once the quota allows it', async () => {
    const id = await candidate({
      runId: 'train-20261207T020000Z',
      bundleId: 'arifnet-open-2',
      lockOpen: true,
      dataEnd: '2026-12-04',
    });
    await confirm(ad);
    // Three manual triggers were used earlier today: the note is kept, no new run.
    const res = await call(app, 'POST', `/v1/admin/model-candidates/${String(id)}/reject`, {
      ...ad,
      body: { note: 'Skor beras masih di atas naive' },
    });
    expect(res.json()).toEqual({ retrain: 'quota' });
    const row = await owner.query<{ status: string; note: string }>(
      'SELECT status::text, note FROM model_candidates WHERE id = $1',
      [id],
    );
    expect(row.rows[0]).toEqual({ status: 'rejected', note: 'Skor beras masih di atas naive' });
    // Next day: the rejection triggers a retraining run.
    clock.set('2026-12-08T09:00:00+07:00');
    // The admin session is at most 12 hours old: sign in again on the next day.
    ad = await account(app, mail, owner, 'admin-besok@contoh.id', { role: 'admin' });
    const next = await candidate({
      runId: 'train-20261208T010000Z',
      bundleId: 'arifnet-open-3',
      lockOpen: true,
      dataEnd: '2026-12-05',
    });
    await confirm(ad);
    const again = await call(app, 'POST', `/v1/admin/model-candidates/${String(next)}/reject`, {
      ...ad,
      body: { note: 'Coba lagi' },
    });
    expect(again.json()).toEqual({ retrain: 'triggered' });
    expect(seen.find((s) => s.method === 'POST' && s.path.endsWith('/dagRuns'))?.body).toEqual({
      logical_date: null,
      conf: {},
    });
  });

  it('approval is atomic, checks the files read now and the data end, and never goes backwards', async () => {
    await confirm(ad);
    // Rejected meanwhile: approving activates nothing.
    const gone = await candidate({
      runId: 'train-20261208T020000Z',
      bundleId: 'arifnet-open-4',
      lockOpen: true,
      dataEnd: '2026-12-05',
    });
    await owner.query(`UPDATE model_candidates SET status = 'rejected' WHERE id = $1`, [gone]);
    const late = await call(app, 'POST', `/v1/admin/model-candidates/${String(gone)}/approve`, ad);
    expect(late.json()).toMatchObject({ error: { fields: ['decided'] } });

    // Files changed after registration, or data past the candidate's data end: refused.
    const swapped = await candidate({
      runId: 'train-20261208T030000Z',
      bundleId: 'arifnet-open-5',
      lockOpen: true,
      dataEnd: '2026-12-05',
    });
    await owner.query(`UPDATE model_candidates SET bundle_sha256 = $2 WHERE id = $1`, [
      swapped,
      'f'.repeat(64),
    ]);
    const tampered = (
      await call(app, 'GET', `/v1/admin/model-candidates/${String(swapped)}`, ad)
    ).json();
    expect(tampered).toMatchObject({ audit: { runtime: { ok: false, reasons: ['checksum'] } } });
    const early = await candidate({
      runId: 'train-20261208T040000Z',
      bundleId: 'arifnet-open-6',
      lockOpen: true,
      dataEnd: '2026-08-01',
    });
    const cut = (await call(app, 'GET', `/v1/admin/model-candidates/${String(early)}`, ad)).json();
    expect((cut['audit'] as { runtime: { reasons: string[] } }).runtime.reasons).toContain(
      'cutoff',
    );

    // A bundle older than the active one is marked superseded (approving would go backwards).
    const older = await candidate({
      runId: 'train-20261208T050000Z',
      bundleId: 'arifnet-open-7',
      lockOpen: true,
      dataEnd: '2026-12-05',
      issuedAt: '2026-12-06T03:00:00+07:00',
    });
    const old = (await call(app, 'GET', `/v1/admin/model-candidates/${String(older)}`, ad)).json();
    expect((old['audit'] as { blockers: string[] }).blockers).toContain('superseded');
    // None of these left a rejected artifact row behind.
    const artifacts = await owner.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM forecast_artifacts WHERE bundle_id LIKE 'arifnet-open-%' AND status = 'rejected'`,
    );
    expect(artifacts.rows[0]?.n).toBe(0);
  });

  it('a candidate whose bundle files are missing or failing is blocked', async () => {
    const res = await call(app, 'POST', '/internal/model-candidates', {
      body: {
        runId: 'train-missing',
        bundleId: 'arifnet-missing',
        bundleSha256: 'b'.repeat(64),
        modelVersion: 'x',
        dataEnd: '2026-12-04',
        lockOpen: true,
        commodities: ['cabai-merah-keriting'],
        overallRelmae: 1.2,
        scores: {},
        window: { start: '2024-12-04', end: '2025-12-04' },
      },
    });
    const id = (res.json() as { id: number }).id;
    const detail = (await call(app, 'GET', `/v1/admin/model-candidates/${String(id)}`, ad)).json();
    expect((detail['audit'] as { blockers: string[] }).blockers.sort()).toEqual([
      'files',
      'quality',
    ]);
  });
});

describe('without Airflow (Fase 4C)', () => {
  it('the pipeline page says Airflow is inactive instead of failing', async () => {
    const plain = await startApp({ clock });
    try {
      const a = await account(plain, mail, owner, 'admin2@contoh.id', { role: 'admin' });
      const res = await call(plain, 'GET', '/v1/admin/pipeline', a);
      expect(res.json()).toMatchObject({ airflow: 'inactive', lock: null, dags: [] });
    } finally {
      await plain.close();
    }
  });
});
