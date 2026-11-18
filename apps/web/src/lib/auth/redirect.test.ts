import { describe, expect, it } from 'vitest';
import { safeNext } from './redirect';

describe('safeNext (the ?ke= target after signing in)', () => {
  it('keeps internal paths, with their query', () => {
    expect(safeNext('/akun')).toBe('/akun');
    expect(safeNext('/harga/bawang-merah?rentang=90')).toBe('/harga/bawang-merah?rentang=90');
  });

  it('refuses anything that could leave the site', () => {
    for (const evil of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      '/%2F%2Fevil.example',
      ' /akun',
      '/akun\n',
      '',
    ]) {
      expect(safeNext(evil), evil).toBe('/akun');
    }
  });

  it('does not send the user back to a sign-in page, and bounds the length', () => {
    expect(safeNext('/masuk')).toBe('/akun');
    expect(safeNext('/daftar?x=1')).toBe('/akun');
    expect(safeNext(`/${'a'.repeat(600)}`)).toBe('/akun');
  });

  it('ignores non-string input', () => {
    expect(safeNext(null)).toBe('/akun');
    expect(safeNext(['/akun'])).toBe('/akun');
  });
});
