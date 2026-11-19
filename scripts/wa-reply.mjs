// Simulates a WhatsApp reply from a phone (Fase 2C mock adapter): what the provider's webhook
// would deliver. Usage: pnpm wa:balas <nomor> <teks...>     e.g. pnpm wa:balas 081234567890 STOP
// Dev stack only (API on 127.0.0.1:3001); the service token comes from .env and is never printed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const env = Object.fromEntries(
  readFileSync(`${root}.env`, 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);

const [from, ...words] = process.argv.slice(2);
if (from === undefined || words.length === 0) {
  process.stderr.write('usage: pnpm wa:balas <nomor> <teks>\n');
  process.exit(1);
}
const res = await fetch(
  `${process.env['API_URL'] ?? 'http://127.0.0.1:3001'}/internal/whatsapp/inbound`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-service-token': env['SERVICE_TOKEN'] ?? '' },
    body: JSON.stringify({ from, text: words.join(' ') }),
  },
);
process.stdout.write(`balasan diterima API: ${String(res.status)}\n`);
process.exitCode = res.ok ? 0 : 1;
