import { describe, expect, it } from 'vitest';
import {
  AuthErrorCodeSchema,
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  EmailSchema,
  LoginInputSchema,
  MeResponseSchema,
  PhoneInputSchema,
  PhoneSchema,
  maskPhone,
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
        phone: null,
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

describe('PhoneSchema (optional mobile number, Fase 2B)', () => {
  it('normalises Indonesian mobile numbers to E.164', () => {
    expect(PhoneSchema.parse('0812-3456-7890')).toBe('+6281234567890');
    expect(PhoneSchema.parse('+62 812 3456 789')).toBe('+628123456789');
    expect(PhoneSchema.parse('6281234567890')).toBe('+6281234567890');
    expect(PhoneSchema.parse(' (0812) 3456 78 ')).toBe('+62812345678');
  });

  it('rejects non-mobile, foreign, too short, too long and non-digit input', () => {
    for (const bad of [
      '021-555-1234',
      '+1 202 555 0100',
      '0812345',
      '08123456789012345',
      '0812abc4567',
      '',
      '++6281234567890',
    ]) {
      expect(PhoneSchema.safeParse(bad).success, bad).toBe(false);
    }
  });
});

describe('phone in account contracts', () => {
  it('register accepts a phone or none', () => {
    const base = {
      email: 'a@b.id',
      password: 'kalimat sandi panjang',
      acceptPrivacy: true as const,
    };
    expect(RegisterInputSchema.parse(base)).toEqual(base);
    expect(RegisterInputSchema.parse({ ...base, phone: '081234567890' }).phone).toBe(
      '+6281234567890',
    );
    expect(RegisterInputSchema.safeParse({ ...base, phone: '12' }).success).toBe(false);
  });

  it('PhoneInputSchema sets a number; me shows it masked or null', () => {
    expect(PhoneInputSchema.parse({ phone: '081234567890' })).toEqual({ phone: '+6281234567890' });
    const me = {
      id: '0192f1d2-0000-7000-8000-000000000000',
      email: 'a@b.id',
      emailVerified: true,
      createdAt: '2026-11-19T00:00:00.000Z',
      csrf: TOKEN,
    };
    expect(MeResponseSchema.safeParse({ ...me, phone: null }).success).toBe(true);
    expect(MeResponseSchema.safeParse({ ...me, phone: '+62 812 •••• 7890' }).success).toBe(true);
    expect(MeResponseSchema.safeParse({ ...me, phone: '+6281234567890' }).success).toBe(false);
  });

  it('maskPhone keeps the country code, operator prefix and last four digits', () => {
    expect(maskPhone('+6281234567890')).toBe('+62 812 •••• 7890');
    expect(maskPhone('+628123456789')).toBe('+62 812 •••• 6789');
  });
});
