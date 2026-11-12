import base from '@kawan-pasar/eslint-config';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';

// Shared strict TypeScript rules + Next.js (Core Web Vitals) + React hooks rules.
export default defineConfig(
  { ignores: ['next-env.d.ts', '.next/**'] },
  ...base,
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat['recommended-latest'],
);
