// Root config: used by the pre-commit hook for files outside workspace packages.
// Each package keeps its own eslint.config.js for `turbo run lint`.
import { defineBaseConfig } from '@kawan-pasar/config/eslint';

export default [
  { ignores: ['apps/**', 'packages/**', 'services/**'] },
  ...defineBaseConfig({ tsconfigRootDir: import.meta.dirname, allowDefaultProject: ['*.js'] }),
];
