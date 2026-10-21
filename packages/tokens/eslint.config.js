import { defineBaseConfig } from '@kawan-pasar/config/eslint';

export default [
  ...defineBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    // The token package is the single source of colour values, so hex literals belong here.
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'TSEnumDeclaration', message: 'Gunakan union `as const`, bukan enum TS.' },
      ],
    },
  },
  {
    // Build script: reads and writes fixed files inside this package only.
    files: ['scripts/**/*.js'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
];
