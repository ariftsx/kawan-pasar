/** Conventional Commits, e.g. `feat(planning): add menu cost simulation` (docs 14 §9). */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 100],
    'scope-case': [2, 'always', 'kebab-case'],
  },
};
