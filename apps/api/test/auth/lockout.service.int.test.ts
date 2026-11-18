import { Redis } from 'ioredis';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { LockoutService } from '../../src/modules/auth/lockout.service.js';

const redis = new Redis(process.env['VALKEY_SESSION_URL'] ?? '');
const lockout = new LockoutService(redis, 'k'.repeat(43));
const EMAIL = 'Sari@Contoh.id';

beforeEach(async () => {
  await redis.flushdb();
});

afterAll(() => {
  redis.disconnect();
});

async function failTimes(n: number): Promise<void> {
  for (let i = 0; i < n; i += 1) await lockout.fail(EMAIL);
}

describe('LockoutService', () => {
  it('locks an account for 1 minute after 5 failures, for any spelling of the e-mail', async () => {
    await failTimes(4);
    expect(await lockout.check('sari@contoh.id')).toEqual({ locked: false });
    await lockout.fail('SARI@contoh.ID');
    const state = await lockout.check(EMAIL);
    expect(state.locked).toBe(true);
    expect(state.locked && state.retryAfter).toBeGreaterThan(55);
    expect(state.locked && state.retryAfter).toBeLessThanOrEqual(60);
  });

  it('grows the lock to 15 minutes at 10 failures and 1 hour at 20', async () => {
    await failTimes(10);
    const ten = await lockout.check(EMAIL);
    expect(ten.locked && ten.retryAfter).toBeGreaterThan(850);
    await failTimes(10);
    const twenty = await lockout.check(EMAIL);
    expect(twenty.locked && twenty.retryAfter).toBeGreaterThan(3500);
  });

  it('clears the failures after a successful sign-in', async () => {
    await failTimes(5);
    await lockout.reset(EMAIL);
    expect(await lockout.check(EMAIL)).toEqual({ locked: false });
  });

  it('never stores the e-mail address in clear', async () => {
    await failTimes(5);
    const keys = await redis.keys('*');
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.join(' ').toLowerCase()).not.toContain('sari');
  });
});
