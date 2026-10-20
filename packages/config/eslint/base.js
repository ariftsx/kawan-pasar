// Shared ESLint flat config (docs 14 §3.3–3.4). Framework-specific rules (React, Nest) extend this.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import security from 'eslint-plugin-security';
import globals from 'globals';
import { config, configs } from 'typescript-eslint';

const HEX_COLOR_LITERAL = String.raw`Literal[value=/^#[0-9a-fA-F]{3,8}$/]`;

/** @type {import('eslint').Linter.RulesRecord} */
const BASE_RULES = {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  'no-restricted-syntax': [
    'error',
    { selector: HEX_COLOR_LITERAL, message: 'Gunakan token warna, bukan hex literal.' },
    { selector: 'TSEnumDeclaration', message: 'Gunakan union `as const`, bukan enum TS.' },
  ],
  'import-x/no-cycle': 'error',
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
  'security/detect-non-literal-regexp': 'error',
  'security/detect-object-injection': 'warn',
  'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
  'max-lines-per-function': ['warn', { max: 60, skipBlankLines: true, skipComments: true }],
  complexity: ['warn', 10],
};

/**
 * @param {{ tsconfigRootDir: string, allowDefaultProject?: string[] }} options
 *   `tsconfigRootDir` is usually `import.meta.dirname` of the consuming eslint.config.js.
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function defineBaseConfig({ tsconfigRootDir, allowDefaultProject = [] }) {
  return config(
    {
      ignores: [
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/.turbo/**',
        '**/node_modules/**',
      ],
    },
    js.configs.recommended,
    configs.strictTypeChecked,
    configs.stylisticTypeChecked,
    importX.flatConfigs.recommended,
    importX.flatConfigs.typescript,
    security.configs.recommended,
    {
      languageOptions: {
        ecmaVersion: 2024,
        sourceType: 'module',
        globals: { ...globals.node },
        parserOptions: {
          projectService: { allowDefaultProject },
          tsconfigRootDir,
        },
      },
      settings: {
        'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
      },
      rules: BASE_RULES,
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
      rules: {
        'max-lines-per-function': 'off',
        'security/detect-object-injection': 'off',
      },
    },
    {
      // Plain JS config files are checked by `tsc --checkJs`; type-aware lint rules stay off here.
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      extends: [configs.disableTypeChecked],
    },
    prettier,
  );
}
