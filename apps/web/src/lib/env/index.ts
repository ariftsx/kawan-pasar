import { parsePublicEnv, type PublicEnv } from './public';

export { parsePublicEnv, type PublicEnv } from './public';

// Next.js inlines NEXT_PUBLIC_* only for literal `process.env.X` reads, hence the explicit object.
export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_DATA_MODE: process.env.NEXT_PUBLIC_DATA_MODE,
});
