import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['node:*', 'node:*/*', 'bun:*', 'bun:*/*', 'bun', 'node'],
          paths: ['crypto', 'fs', 'path', 'os', 'process', 'child_process'],
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Use of process is restricted in core to maintain runtime independence.',
        },
        {
          name: 'Buffer',
          message: 'Use of Buffer is restricted in core to maintain runtime independence.',
        },
      ],
    },
  },
  {
    ignores: ['build/**', 'node_modules/**'],
  },
);
