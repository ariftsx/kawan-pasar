import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { hash as argon2Hash } from '@node-rs/argon2';
import { afterAll, describe, expect, it } from 'vitest';
import { BreachedPasswords } from '../../src/modules/auth/breached-passwords.js';
import { PasswordService } from '../../src/modules/auth/password.service.js';

const dir = mkdtempSync(path.join(tmpdir(), 'kp-breached-'));
const listFile = path.join(dir, 'list.txt.gz');
writeFileSync(listFile, gzipSync('kawanpasar123\nsandisayapanjang\n'));
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const service = new PasswordService(BreachedPasswords.fromFile(listFile));

describe('PasswordService.hash / verify', () => {
  it('hashes with Argon2id and the OWASP parameters (m=19456 KiB, t=2, p=1)', async () => {
    const h = await service.hash('kalimat sandi yang panjang');
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(h).not.toContain('kalimat');
  });

  it('verifies the right password and refuses a wrong one', async () => {
    const h = await service.hash('kalimat sandi yang panjang');
    expect(await service.verify(h, 'kalimat sandi yang panjang')).toEqual({
      ok: true,
      needsRehash: false,
    });
    expect((await service.verify(h, 'kalimat sandi yang salah')).ok).toBe(false);
  });

  it('asks for a rehash when a stored hash used other parameters', async () => {
    const weak = await argon2Hash('kalimat sandi yang panjang', { memoryCost: 4096, timeCost: 1 });
    expect(await service.verify(weak, 'kalimat sandi yang panjang')).toEqual({
      ok: true,
      needsRehash: true,
    });
  });

  it('never throws on a malformed stored hash', async () => {
    expect(await service.verify('not-a-hash', 'apa saja')).toEqual({
      ok: false,
      needsRehash: false,
    });
  });

  it('spends the same work on a dummy hash (used when the e-mail is unknown)', async () => {
    expect((await service.verifyDummy('apa saja yang panjang')).ok).toBe(false);
  });
});

describe('PasswordService.policyProblem', () => {
  it('accepts a long passphrase', () => {
    expect(service.policyProblem('pasar kramat jati pagi hari', 'sari@contoh.id')).toBeNull();
  });

  it('names the problem: length, breached list (any case), or the e-mail itself', () => {
    expect(service.policyProblem('pendek', 'a@b.id')).toBe('too_short');
    expect(service.policyProblem('a'.repeat(129), 'a@b.id')).toBe('too_long');
    expect(service.policyProblem('KawanPasar123', 'a@b.id')).toBe('breached');
    expect(service.policyProblem('Sari@Contoh.id', 'sari@contoh.id')).toBe('same_as_email');
  });
});

describe('BreachedPasswords', () => {
  it('loads the bundled list (passwords of 12+ characters only)', () => {
    const bundled = BreachedPasswords.bundled();
    expect(bundled.size).toBeGreaterThan(10_000);
    expect(bundled.has('qwertyuiopasdfghjkl')).toBe(true);
    expect(bundled.has('pasar kramat jati pagi hari')).toBe(false);
  });
});
