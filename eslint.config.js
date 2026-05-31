import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Allow intentionally-unused identifiers prefixed with underscore.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // TypeScript handles undefined identifiers; avoids false positives on
      // Vitest globals (describe/it/expect) configured via tsconfig "types".
      'no-undef': 'off',
    },
  },
  {
    // Test files: relax a couple of rules that are noisy in specs.
    files: ['**/*.test.{ts,tsx}', 'src/setupTests.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
