// Shared ESLint flat config for every TypeScript workspace in Kawan Pasar.
// Rule of the project: no `any`, no suppressed type errors, no unsafe value flow.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';

const config = defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': true, 'ts-check': false },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      // NestJS modules are decorated classes without members.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },
  prettier,
);

export default config;
