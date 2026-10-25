import { defineBaseConfig } from '@kawan-pasar/config/eslint';

export default [
  ...defineBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['src/**/*.ts'],
    rules: {
      // docs 14 §5: log through the nestjs-pino Logger only.
      'no-console': 'error',
      // Nest modules and DI-only classes are intentionally empty.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
];
