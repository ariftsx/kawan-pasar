import { describe, expect, it } from 'vitest';
import { PhoneCipher } from '../../src/modules/auth/phone-cipher.js';

const SECRET = 'k'.repeat(43);
const USER = '0192f1d2-0000-7000-8000-000000000001';
const OTHER = '0192f1d2-0000-7000-8000-000000000002';
const PHONE = '+6281234567890';

describe('PhoneCipher (AES-256-GCM, keys derived from PHONE_ENC_KEY)', () => {
  const cipher = new PhoneCipher(SECRET);

  it('round-trips a number and never stores it in clear', () => {
    const sealed = cipher.encrypt(PHONE, USER);
    expect(sealed.nonce).toHaveLength(12);
    expect(sealed.ciphertext.toString('latin1')).not.toContain('81234567890');
    expect(cipher.decrypt(sealed, USER)).toBe(PHONE);
  });

  it('uses a fresh nonce every time', () => {
    const a = cipher.encrypt(PHONE, USER);
    const b = cipher.encrypt(PHONE, USER);
    expect(a.nonce.equals(b.nonce)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it('refuses a tampered ciphertext, a ciphertext moved to another user, or another key', () => {
    const sealed = cipher.encrypt(PHONE, USER);
    const flipped = Buffer.from(sealed.ciphertext);
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(() => cipher.decrypt({ ...sealed, ciphertext: flipped }, USER)).toThrow();
    expect(() => cipher.decrypt(sealed, OTHER)).toThrow();
    expect(() => new PhoneCipher('z'.repeat(43)).decrypt(sealed, USER)).toThrow();
  });

  it('gives a stable 32-byte lookup hash that differs per key', () => {
    expect(cipher.lookupHash(PHONE)).toHaveLength(32);
    expect(cipher.lookupHash(PHONE).equals(cipher.lookupHash(PHONE))).toBe(true);
    expect(cipher.lookupHash(PHONE).equals(new PhoneCipher('z'.repeat(43)).lookupHash(PHONE))).toBe(
      false,
    );
  });

  it('needs a secret of at least 32 characters', () => {
    expect(() => new PhoneCipher('short')).toThrow();
  });
});

describe('PhoneCipher key rotation (Fase 2C)', () => {
  const OLD = 'o'.repeat(43);
  const NEW = 'n'.repeat(43);

  it('records which key sealed a number and still opens numbers of the previous key', () => {
    const before = new PhoneCipher(OLD);
    const sealed = before.encrypt(PHONE, USER);
    expect(sealed.keyId).toBe(before.currentKeyId);
    const rotated = new PhoneCipher(NEW, OLD);
    expect(rotated.currentKeyId).not.toBe(before.currentKeyId);
    expect(rotated.decrypt(sealed, USER)).toBe(PHONE);
    expect(rotated.isCurrent(sealed.keyId)).toBe(false);
    expect(rotated.isCurrent(rotated.encrypt(PHONE, USER).keyId)).toBe(true);
  });

  it('refuses a key id it does not hold', () => {
    const sealed = new PhoneCipher(OLD).encrypt(PHONE, USER);
    expect(() => new PhoneCipher(NEW).decrypt(sealed, USER)).toThrow(/unknown phone key/);
  });

  it('looks a number up under the current and the previous key', () => {
    const rotated = new PhoneCipher(NEW, OLD);
    const hashes = rotated.lookupHashes(PHONE);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]?.equals(rotated.lookupHash(PHONE))).toBe(true);
    expect(hashes[1]?.equals(new PhoneCipher(OLD).lookupHash(PHONE))).toBe(true);
  });
});
