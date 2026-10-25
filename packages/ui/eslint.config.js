import eslintReact from '@eslint-react/eslint-plugin';
import { defineBaseConfig } from '@kawan-pasar/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...defineBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-type-checked'],
    rules: {
      ...eslintReact.configs['recommended-type-checked'].rules,
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    },
  },
  reactHooks.configs.flat.recommended,
];
