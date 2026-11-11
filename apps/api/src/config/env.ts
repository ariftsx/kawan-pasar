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
