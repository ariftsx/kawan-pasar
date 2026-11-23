// Test support for the alert specs (Fase 2B). Dev stack only; secrets from .env, passed to child
// processes through the environment, never on the command line.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const env = Object.fromEntries(
  readFileSync(`${root}.env`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

/** Runs one SQL statement in the dev database as the schema owner (setup only). */
export function sql(statement: string, email: string): void {
  const id = execFileSync('docker', ['compose', '-p', 'kawan-pasar', 'ps', '-q', 'postgres'], {
    encoding: 'utf8',
  }).trim();
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      '-e',
      'PGPASSWORD',
      id,
      'psql',
      '-U',
      'kp_owner',
      '-d',
      'kawanpasar',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      `email=${email}`,
    ],
    {
      // Through stdin: psql only expands :'variables' in scripts, not in -c commands.
      input: statement,
      env: { ...process.env, PGPASSWORD: env['KP_OWNER_PASSWORD'] ?? '' },
      encoding: 'utf8',
    },
  );
}

/**
 * Watches report only what happens after they were made. The local data ends on 30 Sep 2026, so
 * a test moves its user's watches back in time: as if they existed when that data arrived.
 */
export function backdateWatches(email: string): void {
  sql(
    "UPDATE alert_watches SET created_at = '2026-09-29T08:00:00+07:00' WHERE user_id = (SELECT id FROM users WHERE email = :'email')",
    email,
  );
}

/** What ingest does after an import: tell the API that prices changed (queues the evaluation). */
export async function pricesChanged(): Promise<void> {
  const res = await fetch('http://127.0.0.1:3001/internal/cache/invalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-service-token': env['SERVICE_TOKEN'] ?? '',
    },
    body: JSON.stringify({ scope: 'prices' }),
  });
  if (res.status !== 200) throw new Error(`invalidate failed: ${String(res.status)}`);
}

const MAILPIT = env['MAILPIT_API_URL'] ?? 'http://127.0.0.1:18025';

/** A fresh Indonesian mobile number per test (0812 + 8 random digits). */
export const newPhone = (): string =>
  `0812${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;

/**
 * The newest mock WhatsApp message to this number whose text contains `contains` (the mock
 * adapter delivers to Mailpit as wa-<digits>@wa-tiruan.invalid). Waits up to 20 s.
 */
export async function waMessage(phone: string, contains: string): Promise<string> {
  const digits = `62${phone.replace(/\D/g, '').replace(/^0/, '')}`;
  const end = Date.now() + 20_000;
  for (;;) {
    const res = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"wa-${digits}@wa-tiruan.invalid"`)}`,
    );
    const list = ((await res.json()) as { messages: { ID: string }[] }).messages;
    for (const m of list) {
      const full = (await (await fetch(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as {
        Text: string;
      };
      if (full.Text.includes(contains)) return full.Text;
    }
    if (Date.now() > end) throw new Error(`no WhatsApp message containing "${contains}"`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

/** What `pnpm wa:balas` does: a reply from the phone, through the mock webhook. */
export async function waReply(phone: string, text: string): Promise<void> {
  const res = await fetch('http://127.0.0.1:3001/internal/whatsapp/inbound', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-service-token': env['SERVICE_TOKEN'] ?? '' },
    body: JSON.stringify({ from: phone, text }),
  });
  if (res.status !== 200) throw new Error(`inbound failed: ${String(res.status)}`);
}
