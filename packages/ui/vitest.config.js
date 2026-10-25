import { defineVitestConfig } from '@kawan-pasar/config/vitest';
import { mergeConfig } from 'vitest/config';

// Components render in happy-dom; Testing Library cleans up after every test.
export default mergeConfig(defineVitestConfig(), {
  test: { environment: 'happy-dom', setupFiles: ['./src/test-setup.ts'] },
});
