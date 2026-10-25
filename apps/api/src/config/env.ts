// Server environment (docs 13 §A3, docs 14 §5). The only module that reads process.env.
import { z } from 'zod';

const CsvList = z.string().transform((value) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
);

const Env = z.strictObject({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Shared with the BFF only; rotated every 90 days (docs 15). */
  SERVICE_TOKEN: z.string().min(32),
  /** Traefik's internal subnet. Never `true`: raw X-Forwarded-For is not trusted (AGENTS §41.4). */
  TRUSTED_PROXY_CIDRS: CsvList.pipe(z.array(z.union([z.cidrv4(), z.cidrv6()])).min(1)).default([
    '10.0.0.0/8',
  ]),
});

export type Env = z.infer<typeof Env>;

/** Throws at boot with every invalid key listed (values are never echoed), so a bad deploy fails fast. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const keys = new Set(Object.keys(Env.shape));
  const picked = Object.fromEntries(Object.entries(source).filter(([key]) => keys.has(key)));
  const result = Env.safeParse(picked);
  if (!result.success) {
    const invalid = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server environment: ${invalid}`);
  }
  return result.data;
}
