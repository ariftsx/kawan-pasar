// Writes infra/.env with fresh random secrets for the local stack. Never overwrites an existing file.
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('../.env', import.meta.url));
const KEYS = ['POSTGRES_PASSWORD', 'VALKEY_PASSWORD', 'SERVICE_TOKEN', 'MODEL_HMAC_SECRET'];

if (existsSync(target)) {
  console.log('infra/.env already exists; delete it to regenerate.');
} else {
  // base64url keeps the values safe inside shell commands and connection URLs.
  const lines = KEYS.map((key) => `${key}=${randomBytes(32).toString('base64url')}`);
  writeFileSync(target, `${lines.join('\n')}\n`, { mode: 0o600 });
  console.log('Wrote infra/.env with random local secrets.');
}
