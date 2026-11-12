import 'server-only';
import { z } from 'zod';

const token = z.string().min(32);

const ServerEnvSchema = z
  .object({
    API_INTERNAL_URL: z.url({ protocol: /^https?$/ }),
    SERVICE_TOKEN: token,
    WEB_REVALIDATE_TOKEN: token,
    API_TIMEOUT_MS: z.coerce.number().int().min(500).max(10_000).default(3000),
  })
  .refine((e) => e.WEB_REVALIDATE_TOKEN !== e.SERVICE_TOKEN, {
    path: ['WEB_REVALIDATE_TOKEN'],
    message: 'must differ from SERVICE_TOKEN',
  });

export type ServerEnv = Readonly<z.infer<typeof ServerEnvSchema>>;

/** Validates the server environment. Errors name the variables, never their values. */
export function parseServerEnv(raw: Record<string, string | undefined>): ServerEnv {
  const parsed = ServerEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))];
    throw new Error(`Invalid web server environment: ${names.join(', ')}`);
  }
  return Object.freeze(parsed.data);
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
