import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { poolFor, resetTestDatabase, sqlState } from '../helpers/test-db.js';

const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const INSUFFICIENT_PRIVILEGE = '42501';
const HASH = `'$argon2id$v=19$m=19456,t=2,p=1$c2FsdA$aGFzaA'`;

let app: pg.Pool;
let ingest: pg.Pool;

beforeAll(async () => {
  await resetTestDatabase();
  app = poolFor('app');
  ingest = poolFor('ingest');
});

afterAll(async () => {
  await Promise.all([app.end(), ingest.end()]);
});

const insertUser = (email: string): string =>
  `INSERT INTO users (email, password_hash) VALUES ('${email}', ${HASH})`;

describe('users', () => {
  it('gets a time-ordered UUID (v7) and treats e-mail addresses case-insensitively', async () => {
    const { rows } = await app.query<{ id: string }>(
      `${insertUser('Sari@Contoh.id')} RETURNING id`,
    );
    expect(rows[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(await sqlState(app, insertUser('sari@contoh.ID'))).toBe(UNIQUE_VIOLATION);
    const found = await app.query(`SELECT 1 FROM users WHERE email = 'SARI@CONTOH.ID'`);
    expect(found.rowCount).toBe(1);
  });

  it('rejects e-mail addresses longer than 254 characters', async () => {
    expect(await sqlState(app, insertUser(`${'a'.repeat(250)}@x.id`))).toBe(CHECK_VIOLATION);
  });

  it('is not readable by the ingest role', async () => {
    expect(await sqlState(ingest, 'SELECT 1 FROM users')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlState(ingest, 'SELECT 1 FROM auth_tokens')).toBe(INSUFFICIENT_PRIVILEGE);
    expect(await sqlState(ingest, 'SELECT 1 FROM auth_events')).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe('auth_tokens and auth_events', () => {
  it('stores only 32-byte token hashes, each at most once', async () => {
    const { rows } = await app.query<{ id: string }>(`${insertUser('t@contoh.id')} RETURNING id`);
    const id = rows[0]?.id ?? '';
    const token = (hash: string): string =>
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ('${id}', 'verify_email', ${hash}, now() + interval '1 day')`;
    expect(await sqlState(app, token(`decode(repeat('ab', 32), 'hex')`))).toBeNull();
    expect(await sqlState(app, token(`decode(repeat('ab', 32), 'hex')`))).toBe(UNIQUE_VIOLATION);
    expect(await sqlState(app, token(`decode('ab', 'hex')`))).toBe(CHECK_VIOLATION);
  });

  it('deleting a user removes its tokens and keeps its audit events without the user', async () => {
    const { rows } = await app.query<{ id: string }>(
      `${insertUser('hapus@contoh.id')} RETURNING id`,
    );
    const id = rows[0]?.id ?? '';
    await app.query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'reset_password', decode(repeat('cd', 32), 'hex'), now() + interval '30 minutes')`,
      [id],
    );
    await app.query(`INSERT INTO auth_events (user_id, type) VALUES ($1, 'login_ok')`, [id]);

    expect(await sqlState(app, `DELETE FROM users WHERE id = '${id}'`)).toBeNull();
    const tokens = await app.query('SELECT 1 FROM auth_tokens WHERE user_id = $1', [id]);
    expect(tokens.rowCount).toBe(0);
    const events = await app.query<{ user_id: string | null }>(
      `SELECT user_id FROM auth_events WHERE type = 'login_ok'`,
    );
    expect(events.rows.map((r) => r.user_id)).toEqual([null]);
  });
});
