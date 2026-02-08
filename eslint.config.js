import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  // ESLint recommended config
  js.configs.recommended,

  // Global ignores (from .eslintignore)
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '*.config.ts',
      '*.config.js',
      '.github/**',
      'tests/fixtures/**',
      'vscode-extension/**',
    ],
  },

  // JavaScript utility scripts (Node runtime)
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.eslint.json',
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // TypeScript ESLint recommended rules
      ...tsPlugin.configs.recommended.rules,

      // Disable no-undef for TypeScript (TypeScript compiler handles this)
      'no-undef': 'off',

      // Custom rules (strict by default)
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': 'off',
    },
  },

  // Tests keep ergonomic typing for fixtures/mocks while preserving strictness
  // for unused vars/non-null assertions in unit tests.
  {
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Integration tests may use looser typing/assertions for harness ergonomics.
  {
    files: ['tests/integration/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
