// Public environment (docs 12 §9). Only these NEXT_PUBLIC_* values may reach the browser;
// server-only values get their own module with `import 'server-only'` when the BFF arrives.
import { z } from 'zod';

const PublicEnv = z.strictObject({
  NEXT_PUBLIC_APP_URL: z.url({ protocol: /^https?$/ }),
  /** `demo` labels every sample number as DATA DEMO (AC-05). */
  NEXT_PUBLIC_DATA_MODE: z.enum(['demo', 'live']),
});

export type PublicEnv = z.infer<typeof PublicEnv>;

/** Throws at boot with every invalid key listed, so a misconfigured deploy fails fast. */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const result = PublicEnv.safeParse({
    NEXT_PUBLIC_APP_URL: source.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_DATA_MODE: source.NEXT_PUBLIC_DATA_MODE,
  });
  if (!result.success) {
    const keys = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid public environment: ${keys}`);
  }
  return result.data;
}
