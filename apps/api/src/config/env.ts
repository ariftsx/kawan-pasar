import { z } from 'zod';

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ }).describe('postgres:// connection URL');
const redisUrl = z.url({ protocol: /^rediss?$/ }).describe('redis:// connection URL');

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: postgresUrl,
  /** Per-replica pool. PgBouncer multiplexes these, so keep it small. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  VALKEY_CACHE_URL: redisUrl,
  VALKEY_QUEUE_URL: redisUrl,
  SERVICE_TOKEN: z.string().min(32),
  /** Requests per minute per client and route group (second layer after Traefik). */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(120),
  /**
   * Budget for the web server's own requests (rendering/revalidation: from a trusted proxy and
   * without X-Forwarded-For). Shared by all of those requests, so it is larger.
   */
  RATE_LIMIT_INTERNAL_PER_MINUTE: z.coerce.number().int().min(1).max(100_000).default(1200),
  /** Comma-separated proxy IPs allowed to set X-Forwarded-For (the web/BFF container). */
  TRUSTED_PROXY_IPS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    )
    .pipe(z.array(z.ipv4())),
  /** Web server (Next.js) that is told to revalidate its cache tags after data changes. */
  // One or more web replicas (comma-separated). Each one is revalidated: with a shared page cache
  // one is enough, but a replica that is down must not stop the others (ADR 0010).
  WEB_INTERNAL_URL: z
    .string()
    .transform((v) =>
      v
        .split(',')
        .map((u) => u.trim())
        .filter((u) => u !== ''),
    )
    .pipe(
      z
        .array(z.url({ protocol: /^https?$/ }))
        .min(1)
        .max(10),
    )
    .optional(),
  WEB_REVALIDATE_TOKEN: z.string().min(32).optional(),
  // --- accounts (Fase 2A) ---
  /** Sessions, lockouts and account rate limits (valkey-session: noeviction, ADR 0011). */
  VALKEY_SESSION_URL: redisUrl,
  /** Keys the HMACs of e-mail addresses (lockout) and client IPs (audit). Never logged. */
  AUTH_SECRET: z.string().min(32),
  /** Derives the keys that encrypt and look up mobile numbers (PhoneCipher, Fase 2B). Never logged. */
  PHONE_ENC_KEY: z.string().min(32),
  /** Only during a key rotation: the previous PHONE_ENC_KEY, so older numbers still open. */
  PHONE_ENC_KEY_PREVIOUS: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(32).optional(),
  ),
  /** Argon2 hashes that may run at once (≈ API cores) and may wait (HashGate, Fase 2A). */
  AUTH_HASH_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  AUTH_HASH_QUEUE: z.coerce.number().int().min(0).max(1000).default(16),
  /** Outgoing mail (Mailpit locally). Only the worker connects; the API just queues. */
  SMTP_URL: z.url({ protocol: /^smtps?$/ }),
  MAIL_FROM: z.string().min(3).max(200),
  /** Origin used in e-mailed links. */
  PUBLIC_SITE_URL: z.url({ protocol: /^https?$/ }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

const EnvWithRulesSchema = EnvSchema.refine(
  (env) => (env.WEB_INTERNAL_URL === undefined) === (env.WEB_REVALIDATE_TOKEN === undefined),
  {
    path: ['WEB_REVALIDATE_TOKEN'],
    message: 'WEB_INTERNAL_URL and WEB_REVALIDATE_TOKEN go together',
  },
);

/** Thrown when the environment is invalid. Carries variable names only, never their values. */
export class EnvValidationError extends Error {
  readonly variables: readonly string[];

  constructor(variables: readonly string[]) {
    super(`invalid or missing environment variables: ${variables.join(', ')}`);
    this.name = 'EnvValidationError';
    this.variables = variables;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const result = EnvWithRulesSchema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '?')))];
  throw new EnvValidationError(names.sort());
}
