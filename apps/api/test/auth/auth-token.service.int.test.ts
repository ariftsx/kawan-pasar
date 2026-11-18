import { createHash } from 'node:crypto';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../src/database/client.js';
import { AuthTokenService } from '../../src/modules/auth/auth-token.service.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

let pool: pg.Pool;
let tokens: AuthTokenService;
let userId = '';
const clock = { t: Date.parse('2026-11-17T00:00:00Z') };

beforeAll(async () => {
  await resetTestDatabase();
  pool = poolFor('app');
  tokens = new AuthTokenService(createDb(pool), { now: () => new Date(clock.t) });
});

beforeEach(async () => {
  clock.t = Date.parse('2026-11-17T00:00:00Z');
  await pool.query('DELETE FROM users');
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ('t@contoh.id', '$argon2id$x') RETURNING id`,
  );
  userId = rows[0]?.id ?? '';
});

afterAll(async () => {
  await pool.end();
});

describe('AuthTokenService', () => {
  it('issues a 32-byte token and stores only its SHA-256', async () => {
    const token = await tokens.issue(userId, 'verify_email');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { rows } = await pool.query<{ token_hash: Buffer }>('SELECT token_hash FROM auth_tokens');
    expect(rows[0]?.token_hash.equals(createHash('sha256').update(token).digest())).toBe(true);
  });

  it('can be used once, for its own purpose only', async () => {
    const token = await tokens.issue(userId, 'reset_password');
    expect(await tokens.consume(token, 'verify_email')).toBeNull();
    expect(await tokens.consume(token, 'reset_password')).toBe(userId);
    expect(await tokens.consume(token, 'reset_password')).toBeNull();
  });

  it('lets exactly one of many concurrent uses succeed', async () => {
    const token = await tokens.issue(userId, 'reset_password');
    const results = await Promise.all(
      Array.from({ length: 10 }, () => tokens.consume(token, 'reset_password')),
    );
    expect(results.filter((r) => r === userId)).toHaveLength(1);
  });

  it('expires: verification after 24 hours, reset after 30 minutes', async () => {
    const verify = await tokens.issue(userId, 'verify_email');
    const reset = await tokens.issue(userId, 'reset_password');
    clock.t += 30 * 60_000 + 1;
    expect(await tokens.consume(reset, 'reset_password')).toBeNull();
    clock.t += 24 * 3_600_000;
    expect(await tokens.consume(verify, 'verify_email')).toBeNull();
  });

  it('a newer token of the same purpose cancels the older one', async () => {
    const first = await tokens.issue(userId, 'reset_password');
    const second = await tokens.issue(userId, 'reset_password');
    expect(await tokens.consume(first, 'reset_password')).toBeNull();
    expect(await tokens.consume(second, 'reset_password')).toBe(userId);
  });

  it('rejects malformed tokens without a query error', async () => {
    expect(await tokens.consume('pendek', 'reset_password')).toBeNull();
  });
});
