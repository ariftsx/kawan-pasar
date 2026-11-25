// Generates a local .env with fresh random secrets and the derived connection URLs.
// Usage: node scripts/gen-env.mjs [--force | --add-missing] [--prod <host>]
// Refuses to overwrite an existing .env unless --force is given (rotating secrets
// requires recreating the data volumes: `pnpm infra:down -v`).
// --add-missing appends secrets introduced by a later phase (e.g. WEB_REVALIDATE_TOKEN) to an
// existing .env without touching the values already there.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const target = new URL('../.env', import.meta.url);
const secret = () => randomBytes(32).toString('base64url');
// Airflow's Fernet key: url-safe base64 of 32 bytes WITH padding (44 characters).
const fernetKey = () => randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
// Generators other than secret() (Fase 4B).
const SPECIAL = { AIRFLOW_FERNET_KEY: fernetKey };
const make = (key) => (SPECIAL[key] ?? secret)();

// Secrets added after Fase 0. They do not affect any data volume, so they can be added safely.
const LATER_SECRETS = [
  'WEB_REVALIDATE_TOKEN',
  'AUTH_SECRET',
  'PHONE_ENC_KEY',
  // Fase 4B: Apache Airflow (own database role, UI admin, Core API service account, keys).
  'AIRFLOW_DB_PASSWORD',
  'AIRFLOW_ADMIN_PASSWORD',
  'AIRFLOW_API_PASSWORD',
  'AIRFLOW_JWT_SECRET',
  'AIRFLOW_FERNET_KEY',
];

if (process.argv.includes('--add-missing')) {
  if (!existsSync(target)) {
    console.error('.env does not exist — run without flags first');
    process.exit(1);
  }
  const lines = readFileSync(target, 'utf8').split(/\r?\n/);
  // A key with an empty value (e.g. copied from .env.example) counts as missing.
  const filled = new Set(
    lines.filter((l) => /^[A-Z0-9_]+=.+/.test(l)).map((l) => l.slice(0, l.indexOf('='))),
  );
  const value = (key) => {
    const line = lines.find((l) => l.startsWith(`${key}=`));
    return line === undefined ? '' : line.slice(key.length + 1);
  };
  // Host-side URLs added after Fase 0, derived from secrets already in .env.
  const laterUrls = {
    VALKEY_SESSION_URL: () => `redis://:${value('VALKEY_PASSWORD')}@127.0.0.1:16381/0`,
    SMTP_URL: () => 'smtp://127.0.0.1:11025',
    MAILPIT_API_URL: () => 'http://127.0.0.1:18025',
  };
  const missingSecrets = LATER_SECRETS.filter((k) => !filled.has(k));
  const missingUrls = Object.keys(laterUrls).filter((k) => !filled.has(k));
  const missing = [...missingSecrets, ...missingUrls];
  if (missing.length > 0) {
    // Drop empty placeholders and never glue onto a last line without a newline.
    const kept = lines.filter((l) => !missing.some((k) => l.startsWith(`${k}=`)));
    const head = kept.join('\n').replace(/\n*$/, '\n');
    const added = [
      ...missingSecrets.map((k) => `${k}=${make(k)}`),
      ...missingUrls.map((k) => `${k}=${laterUrls[k]()}`),
    ].join('\n');
    writeFileSync(target, `${head}${added}\n`, { mode: 0o600 });
  }
  console.log(
    missing.length > 0 ? `added: ${missing.join(', ')} (values not shown)` : 'nothing to add',
  );
  process.exit(0);
}

// --prod <host> (Fase 5, ADR 0018): the server's own .env. No test databases or Mailpit URLs; the
// site's host name and the mail settings the production overlay requires. MAIL_SMTP_URL is left
// empty on purpose: compose refuses to start until the owner fills in the provider's URL.
const prodAt = process.argv.indexOf('--prod');
const prodHost = prodAt === -1 ? null : (process.argv[prodAt + 1] ?? '');
if (prodHost !== null && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(prodHost)) {
  console.error('--prod needs the site host name, e.g. --prod kawanpasar.ariftsx.id');
  process.exit(1);
}
if (existsSync(target) && !process.argv.includes('--force')) {
  console.error('.env already exists — pass --force to regenerate (then run: pnpm infra:down -v)');
  process.exit(1);
}

const s = {
  POSTGRES_SUPERUSER_PASSWORD: secret(),
  KP_OWNER_PASSWORD: secret(),
  APP_RW_PASSWORD: secret(),
  INGEST_W_PASSWORD: secret(),
  PGBOUNCER_AUTH_PASSWORD: secret(),
  VALKEY_PASSWORD: secret(),
  SERVICE_TOKEN: secret(),
  WEB_REVALIDATE_TOKEN: secret(),
  AUTH_SECRET: secret(),
  PHONE_ENC_KEY: secret(),
  AIRFLOW_DB_PASSWORD: secret(),
  AIRFLOW_ADMIN_PASSWORD: secret(),
  AIRFLOW_API_PASSWORD: secret(),
  AIRFLOW_JWT_SECRET: secret(),
  AIRFLOW_FERNET_KEY: fernetKey(),
};

const pg = (user, pw, port, db) => `postgres://${user}:${pw}@127.0.0.1:${port}/${db}`;

const mailDomain = prodHost === null ? '' : prodHost.split('.').slice(-2).join('.');

const local = [
  `TEST_DATABASE_MIGRATION_URL=${pg('kp_owner', s.KP_OWNER_PASSWORD, 15432, 'kawanpasar_test')}`,
  `TEST_DATABASE_URL=${pg('app_rw', s.APP_RW_PASSWORD, 16432, 'kawanpasar_test')}`,
  `TEST_INGEST_DATABASE_URL=${pg('ingest_w', s.INGEST_W_PASSWORD, 16432, 'kawanpasar_test')}`,
  `VALKEY_QUEUE_URL=redis://:${s.VALKEY_PASSWORD}@127.0.0.1:16380/0`,
  'SMTP_URL=smtp://127.0.0.1:11025',
  'MAILPIT_API_URL=http://127.0.0.1:18025',
];
const production =
  prodHost === null
    ? []
    : [
        '',
        '# --- production (Fase 5) ---',
        `SITE_HOST=${prodHost}`,
        `PUBLIC_SITE_URL=https://${prodHost}`,
        `MAIL_FROM=Kawan Pasar <noreply@${mailDomain}>`,
        '# Fill in before starting: smtps://<login>:<SMTP key>@smtp-relay.brevo.com:465',
        'MAIL_SMTP_URL=',
      ];

const lines = [
  prodHost === null
    ? '# Generated by scripts/gen-env.mjs — local development only. Never commit.'
    : '# Generated by scripts/gen-env.mjs --prod — this server only. Never commit or copy.',
  '',
  '# --- secrets (consumed by docker compose) ---',
  ...Object.entries(s).map(([k, v]) => `${k}=${v}`),
  'LOG_LEVEL=info',
  '',
  '# --- host-side URLs (tooling and tests on this machine; containers use internal hostnames) ---',
  `DATABASE_MIGRATION_URL=${pg('kp_owner', s.KP_OWNER_PASSWORD, 15432, 'kawanpasar')}`,
  `DATABASE_URL=${pg('app_rw', s.APP_RW_PASSWORD, 16432, 'kawanpasar')}`,
  `INGEST_DATABASE_URL=${pg('ingest_w', s.INGEST_W_PASSWORD, 16432, 'kawanpasar')}`,
  `VALKEY_CACHE_URL=redis://:${s.VALKEY_PASSWORD}@127.0.0.1:16379/0`,
  `VALKEY_SESSION_URL=redis://:${s.VALKEY_PASSWORD}@127.0.0.1:16381/0`,
  ...(prodHost === null ? local : []),
  ...production,
  '',
];

writeFileSync(target, lines.join('\n'), { mode: 0o600 });
console.log('.env written (values not shown)');
