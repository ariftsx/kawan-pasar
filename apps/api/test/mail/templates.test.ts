import { describe, expect, it } from 'vitest';
import { renderMail } from '../../src/modules/mail/templates.js';

const SITE = 'https://kawanpasar.example';
const TOKEN = 'Ab_-'.repeat(10) + 'xyz';

describe('renderMail', () => {
  it('verification: Indonesian subject, a link to the verification page with the token', () => {
    const mail = renderMail({ template: 'verify_email', to: 'a@b.id', token: TOKEN }, SITE);
    expect(mail?.subject).toBe('Verifikasi email akun Kawan Pasar Anda');
    expect(mail?.text).toContain(`${SITE}/verifikasi-email?t=${TOKEN}`);
    expect(mail?.html).toContain(`href="${SITE}/verifikasi-email?t=${TOKEN}"`);
    expect(mail?.text).toContain('24 jam');
  });

  it('reset: link to the reset page, valid 30 minutes, and what to do if it was not you', () => {
    const mail = renderMail({ template: 'reset_password', to: 'a@b.id', token: TOKEN }, SITE);
    expect(mail?.text).toContain(`${SITE}/atur-ulang-sandi?t=${TOKEN}`);
    expect(mail?.text).toContain('30 menit');
    expect(mail?.text).toContain('abaikan');
  });

  it('notices carry no token and point to the sign-in or reset pages', () => {
    for (const template of ['already_registered', 'password_changed', 'account_deleted'] as const) {
      const mail = renderMail({ template, to: 'a@b.id' }, SITE);
      expect(mail?.subject.length).toBeGreaterThan(5);
      expect(mail?.text).not.toContain('?t=');
    }
    expect(renderMail({ template: 'already_registered', to: 'a@b.id' }, SITE)?.text).toContain(
      `${SITE}/lupa-sandi`,
    );
  });

  it('never puts the recipient address or anything unescaped into the HTML', () => {
    const mail = renderMail(
      { template: 'verify_email', to: 'a@b.id', token: TOKEN },
      'https://x.example/"><script>',
    );
    expect(mail?.html).not.toContain('<script>');
    expect(mail?.html).not.toContain('a@b.id');
  });

  it('sends nothing for the no-op job', () => {
    expect(renderMail({ template: 'noop' }, SITE)).toBeNull();
  });

  it('refuses a link template without its token', () => {
    expect(() => renderMail({ template: 'verify_email', to: 'a@b.id' }, SITE)).toThrow(/token/);
  });
});
