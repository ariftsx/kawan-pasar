import { describe, expect, it } from 'vitest';
import {
  AuthErrorCodeSchema,
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  EmailSchema,
  LoginInputSchema,
  MeResponseSchema,
  PasswordSchema,
  RegisterInputSchema,
  ResetInputSchema,
  SessionsResponseSchema,
  TokenSchema,
} from './auth.js';

const TOKEN = 'a'.repeat(43);

describe('EmailSchema', () => {
  it('trims and accepts ordinary addresses, keeps the case for display', () => {
    expect(EmailSchema.parse('  Sari@Contoh.id ')).toBe('Sari@Contoh.id');
  });

  it('rejects malformed and over-long addresses', () => {
    expect(EmailSchema.safeParse('bukan-email').success).toBe(false);
    expect(EmailSchema.safeParse(`${'a'.repeat(250)}@x.id`).success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('needs 12 to 128 characters, counted as Unicode code points, without composition rules', () => {
    expect(PasswordSchema.safeParse('a'.repeat(11)).success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(12)).success).toBe(true);
    expect(PasswordSchema.safeParse('kalimat sandi panjang').success).toBe(true);
    expect(PasswordSchema.safeParse('🌶'.repeat(12)).success).toBe(true);
    expect(PasswordSchema.safeParse('🌶'.repeat(129)).success).toBe(false);
    expect(PasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });

  it('is not trimmed (spaces are part of a password)', () => {
    expect(PasswordSchema.parse('  dua belas!  ')).toBe('  dua belas!  ');
  });
});

describe('inputs are strict', () => {
  it('rejects unknown properties', () => {
    expect(
      LoginInputSchema.safeParse({ email: 'a@b.id', password: 'x'.repeat(12), role: 'admin' })
        .success,
    ).toBe(false);
  });

  it('requires accepting the privacy policy to register', () => {
    const base = { email: 'a@b.id', password: 'x'.repeat(12) };
    expect(RegisterInputSchema.safeParse({ ...base, acceptPrivacy: false }).success).toBe(false);
    expect(RegisterInputSchema.safeParse({ ...base, acceptPrivacy: true }).success).toBe(true);
  });

  it('login accepts any non-empty password up to 128 characters (policy applies on set only)', () => {
    expect(LoginInputSchema.safeParse({ email: 'a@b.id', password: 'pendek' }).success).toBe(true);
    expect(LoginInputSchema.safeParse({ email: 'a@b.id', password: '' }).success).toBe(false);
  });

  it('change and delete need the current password; change needs a valid new one', () => {
    expect(
      ChangePasswordInputSchema.safeParse({ current: 'lama', next: 'baru sekali ya!' }).success,
    ).toBe(true);
    expect(ChangePasswordInputSchema.safeParse({ current: 'lama', next: 'pendek' }).success).toBe(
      false,
    );
    expect(DeleteAccountInputSchema.safeParse({ password: '' }).success).toBe(false);
  });
});

describe('TokenSchema', () => {
  it('accepts exactly 43 base64url characters (32 random bytes)', () => {
    expect(TokenSchema.safeParse(TOKEN).success).toBe(true);
    expect(TokenSchema.safeParse(`${TOKEN}a`).success).toBe(false);
    expect(TokenSchema.safeParse(`${'a'.repeat(42)}=`).success).toBe(false);
    expect(ResetInputSchema.safeParse({ token: TOKEN, password: 'x'.repeat(12) }).success).toBe(
      true,
    );
  });
});

describe('responses', () => {
  it('describe the account and its sessions', () => {
    expect(
      MeResponseSchema.safeParse({
        id: '0190a0b0-0000-7000-8000-000000000000',
        email: 'a@b.id',
        emailVerified: false,
        createdAt: '2026-11-17T00:00:00.000Z',
        csrf: TOKEN,
      }).success,
    ).toBe(true);
    expect(
      SessionsResponseSchema.safeParse({
        items: [
          {
            id: 'ab'.repeat(16),
            current: true,
            createdAt: '2026-11-17T00:00:00.000Z',
            lastSeenAt: '2026-11-17T00:00:00.000Z',
            device: 'Chrome · Windows',
          },
        ],
      }).success,
    ).toBe(true);
  });

  it('names a closed set of error codes', () => {
    expect(AuthErrorCodeSchema.options).toEqual([
      'invalid_credentials',
      'locked',
      'rate_limited',
      'weak_password',
      'invalid_token',
      'csrf',
      'unauthenticated',
    ]);
  });
});
