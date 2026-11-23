import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { pruneAccountData } from '../../src/modules/maintenance/retention.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

let pool: pg.Pool;
const NOW = new Date('2026-11-17T00:00:00Z');

beforeAll(async () => {
  await resetTestDatabase();
  pool = poolFor('app');
});

beforeEach(async () => {
  await pool.query('DELETE FROM users');
  await pool.query('DELETE FROM auth_events');
});

afterAll(async () => {
  await pool.end();
});

describe('pruneAccountData', () => {
  it('deletes audit events older than 90 days and keeps newer ones', async () => {
    await pool.query(
      `INSERT INTO auth_events (type, created_at) VALUES
         ('login_ok', $1::timestamptz - interval '91 days'),
         ('login_ok', $1::timestamptz - interval '89 days')`,
      [NOW],
    );
    const result = await pruneAccountData(createDb(pool), NOW);
    expect(result.events).toBe(1);
    const { rowCount } = await pool.query('SELECT 1 FROM auth_events');
    expect(rowCount).toBe(1);
  });

  it('deletes e-mail tokens a day after they expired or were used, keeps live ones', async () => {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ('r@contoh.id', '$argon2id$x') RETURNING id`,
    );
    const id = rows[0]?.id ?? '';
    await pool.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at, used_at) VALUES
         ($1, 'verify_email', decode(repeat('01', 32), 'hex'), $2::timestamptz - interval '2 days', NULL),
         ($1, 'reset_password', decode(repeat('02', 32), 'hex'), $2::timestamptz + interval '1 hour', $2::timestamptz - interval '2 days'),
         ($1, 'verify_email', decode(repeat('03', 32), 'hex'), $2::timestamptz + interval '1 hour', NULL)`,
      [id, NOW],
    );
    const result = await pruneAccountData(createDb(pool), NOW);
    expect(result.tokens).toBe(2);
    const { rowCount } = await pool.query('SELECT 1 FROM auth_tokens');
    expect(rowCount).toBe(1);
  });
});

describe('audit_log retention (Fase 3A)', () => {
  it('removes year-old entries only, and the app role cannot delete audit entries itself', async () => {
    const owner = poolFor('owner');
    const app = poolFor('app');
    try {
      await owner.query('DELETE FROM audit_log');
      await owner.query(
        `INSERT INTO audit_log (action, target, created_at) VALUES
         ('export_prices', 'old', now() - interval '400 days'),
         ('export_prices', 'new', now() - interval '10 days')`,
      );
      const r = await pruneAccountData(createDb(app), new Date());
      expect(r.audit).toBe(1);
      const left = await owner.query<{ target: string }>('SELECT target FROM audit_log');
      expect(left.rows).toEqual([{ target: 'new' }]);
      await expect(app.query('DELETE FROM audit_log')).rejects.toMatchObject({ code: '42501' });
    } finally {
      await app.end();
      await owner.end();
    }
  });
});
