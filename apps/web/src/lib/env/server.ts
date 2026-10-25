// Server-only environment (docs 12 §9). Parsed on first use, not at import, so `next build`
// never needs runtime secrets.
import 'server-only';

import { z } from 'zod';

const ServerEnv = z.strictObject({
  /** Core API on the internal network, e.g. http://api:4000. */
  API_INTERNAL_URL: z.url({ protocol: /^https?$/ }),
  /** Shared with apps/api only; never exposed through NEXT_PUBLIC_*. */
  SERVICE_TOKEN: z.string().min(32),
});

export type ServerEnv = z.infer<typeof ServerEnv>;

/** Throws with every invalid key listed; values are never echoed. */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = ServerEnv.safeParse({
    API_INTERNAL_URL: source.API_INTERNAL_URL,
    SERVICE_TOKEN: source.SERVICE_TOKEN,
  });
  if (!result.success) {
    const keys = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid server environment: ${keys}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
