// Test support for the account specs (Fase 2A): reading e-mails from the local Mailpit inbox,
// creating verified users through the dev API, and resetting the account rate-limit counters.
// Uses the dev stack only (ports published by the dev-tools overlay); secrets come from .env and
// are passed to child processes through the environment, never on the command line.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const env = Object.fromEntries(
  readFileSync(`${root}.env`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const MAILPIT = env['MAILPIT_API_URL'] ?? 'http://127.0.0.1:18025';
const API = 'http://127.0.0.1:3001';

export const PASSWORD = 'pasar kramat jati pagi hari';

/** A fresh address per test, so tests never share accounts. */
export const newEmail = (tag: string): string => `e2e-${tag}-${randomUUID().slice(0, 8)}@contoh.id`;

/**
 * Every browser test comes from the same address, so the per-IP account limits (register 5/h,
 * sign-in 10/min) would trip across tests. Clears only those counters, not the lockouts.
 */
export function resetAccountRateLimits(): void {
  const id = execFileSync(
    'docker',
    ['compose', '-p', 'kawan-pasar', 'ps', '-q', 'valkey-session'],
    {
      encoding: 'utf8',
    },
  ).trim();
  execFileSync(
    'docker',
    [
      'exec',
      '-e',
      'REDISCLI_AUTH',
      id,
      'valkey-cli',
      '--no-auth-warning',
      'eval',
      "for _,k in ipairs(redis.call('keys','kp:v1:arl:*')) do redis.call('del',k) end return 1",
      '0',
    ],
    { env: { ...process.env, REDISCLI_AUTH: env['VALKEY_PASSWORD'] ?? '' }, encoding: 'utf8' },
  );
}

interface MailSummary {
  ID: string;
  Subject: string;
}

/** The newest e-mail to `to` whose subject contains `subject` (waits up to 15 s). */
export async function latestMail(
  to: string,
  subject: string,
): Promise<{ subject: string; text: string }> {
  const end = Date.now() + 15_000;
  for (;;) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const found = ((await res.json()) as { messages: MailSummary[] }).messages.find((m) =>
      m.Subject.includes(subject),
    );
    if (found !== undefined) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${found.ID}`)).json()) as {
        Text: string;
      };
      return { subject: found.Subject, text: full.Text };
    }
    if (Date.now() > end) throw new Error(`no e-mail "${subject}" for ${to}`);
    await delay(250);
  }
}

/** Path (with query) of the first site link in an e-mail that leads to `page`. */
export function linkTo(text: string, page: string): string {
  const match = new RegExp(`https?://[^\\s/]+(${page}\\?t=[A-Za-z0-9_-]{43})`).exec(text);
  if (match?.[1] === undefined) throw new Error(`no ${page} link in e-mail`);
  return match[1];
}

async function api(path: string, body: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-token': env['SERVICE_TOKEN'] ?? '',
    },
    body: JSON.stringify(body),
  });
}

/** Registers and verifies a user through the API (setup only; journeys use the UI). */
export async function createVerifiedUser(tag: string): Promise<string> {
  const email = newEmail(tag);
  const res = await api('/v1/auth/register', { email, password: PASSWORD, acceptPrivacy: true });
  if (res.status !== 202) throw new Error(`register failed: ${String(res.status)}`);
  const mail = await latestMail(email, 'Verifikasi');
  const token = linkTo(mail.text, '/verifikasi-email').split('t=')[1];
  const verify = await api('/v1/auth/verify-email', { token });
  if (verify.status !== 204) throw new Error(`verify failed: ${String(verify.status)}`);
  return email;
}
