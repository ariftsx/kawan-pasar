import { fileURLToPath } from 'node:url';
import config from '../index.js';

export default [
  ...config,
  {
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: ['./tsconfig.json'],
        tsconfigRootDir: fileURLToPath(new URL('./fixtures/', import.meta.url)),
      },
    },
  },
];
