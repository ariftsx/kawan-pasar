import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { grantAdmin } from '../../src/cli/grant-admin.js';
import { grantRole } from '../../src/cli/grant-role.js';
import { createDb } from '../../src/database/client.js';
import { poolFor, resetTestDatabase } from '../helpers/test-db.js';

// Shape-valid Argon2id string (the users table checks the format); never verified here.
const HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaA';

let owner: pg.Pool;
let app: pg.Pool;

async function user(email: string, role = 'user'): Promise<string> {
  const r = await owner.query<{ id: string }>(
    'INSERT INTO users (email, password_hash, email_verified_at, role) VALUES ($1, $2, now(), $3) RETURNING id',
    [email, HASH, role],
  );
  return r.rows[0]?.id ?? '';
}

async function roleOf(email: string): Promise<string | undefined> {
  const r = await owner.query<{ role: string }>('SELECT role FROM users WHERE email = $1', [email]);
  return r.rows[0]?.role;
}

beforeAll(async () => {
  await resetTestDatabase();
  owner = poolFor('owner');
  app = poolFor('app');
});

beforeEach(async () => {
  await owner.query('DELETE FROM users');
  await owner.query('DELETE FROM audit_log');
});

afterAll(async () => {
  await app.end();
  await owner.end();
});

describe('admin CLI (Fase 3B task 1)', () => {
  it('grants and revokes admin, from any role, and records both', async () => {
    const id = await user('admin@contoh.id', 'analyst');
    const db = createDb(app);
    expect(await grantAdmin(db, 'ADMIN@contoh.id', 'grant')).toBe('granted');
    expect(await roleOf('admin@contoh.id')).toBe('admin');
    expect(await grantAdmin(db, 'admin@contoh.id', 'grant')).toBe('unchanged');
    expect(await grantAdmin(db, 'admin@contoh.id', 'revoke')).toBe('revoked');
    // Revoking returns the account to a plain user (never silently back to analyst).
    expect(await roleOf('admin@contoh.id')).toBe('user');
    expect(await grantAdmin(db, 'admin@contoh.id', 'revoke')).toBe('unchanged');
    expect(await grantAdmin(db, 'tidak@ada.id', 'grant')).toBe('not_found');
    const audit = await owner.query<{ action: string; target: string; actor_id: string | null }>(
      'SELECT action, target, actor_id FROM audit_log ORDER BY id',
    );
    expect(audit.rows).toEqual([
      { action: 'admin_grant', target: `user:${id}`, actor_id: null },
      { action: 'admin_revoke', target: `user:${id}`, actor_id: null },
    ]);
  });

  it('role:grant still never touches an admin', async () => {
    await user('admin@contoh.id', 'admin');
    expect(await grantRole(createDb(app), 'admin@contoh.id', 'user')).toBe('refused_admin');
    expect(await roleOf('admin@contoh.id')).toBe('admin');
  });

  it('a grant closes a pending analyst request as approved (admin includes analyst access)', async () => {
    const id = await user('calon@contoh.id');
    await owner.query(
      "INSERT INTO analyst_requests (user_id, reason) VALUES ($1, 'Kajian inflasi pangan')",
      [id],
    );
    await grantAdmin(createDb(app), 'calon@contoh.id', 'grant');
    const r = await owner.query<{ status: string }>('SELECT status FROM analyst_requests');
    expect(r.rows).toEqual([{ status: 'approved' }]);
  });
});
