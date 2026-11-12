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
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

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
  const result = EnvSchema.safeParse(source);
  if (result.success) return result.data;
  const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? '?')))];
  throw new EnvValidationError(names.sort());
}
