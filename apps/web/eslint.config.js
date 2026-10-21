import eslintReact from '@eslint-react/eslint-plugin';
import { defineBaseConfig } from '@kawan-pasar/config/eslint';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

// CommonJS plugin: read `configs` off the default export.
// eslint-disable-next-line import-x/no-named-as-default-member -- the CommonJS plugin has no real named export
const { configs: nextConfigs } = nextPlugin;

export default [
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...defineBaseConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['**/*.{ts,tsx}'],
    ...eslintReact.configs['recommended-type-checked'],
    rules: {
      ...eslintReact.configs['recommended-type-checked'].rules,
      // docs 12 §9: no dangerouslySetInnerHTML anywhere.
      '@eslint-react/dom-no-dangerously-set-innerhtml': 'error',
    },
  },
  reactHooks.configs.flat.recommended,
  nextConfigs['core-web-vitals'],
];
