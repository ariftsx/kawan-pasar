import { defineVitestConfig } from '@kawan-pasar/config/vitest';

// Entrypoints only wire the app together; they are exercised by the boot test through createApp().
export default defineVitestConfig({ coverageInclude: ['src/**/!(main|worker).ts'] });
