import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import hooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier/flat';

function boundary(files, imports, message) {
  return {
    files,
    rules: { 'no-restricted-imports': ['error', { patterns: [{ group: imports, message }] }] },
  };
}

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'data/**',
      'artifacts/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}', 'tests/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': hooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
  boundary(
    ['packages/{contracts,domain,demo-data}/src/**/*.ts'],
    ['**/apps/**', '@rep-counter/api', '@rep-counter/web', 'react', 'react/*', 'express', 'node:*'],
    'Shared data and domain packages must stay independent of application frameworks and runtime adapters.',
  ),
  boundary(
    ['apps/api/src/application/**/*.ts'],
    ['express', 'node:*', '**/infrastructure/**', '**/presentation/**', '@rep-counter/demo-data/*'],
    'Use cases depend on contracts and ports; wire concrete implementations at the composition root.',
  ),
  boundary(
    ['apps/api/src/presentation/**/*.ts'],
    ['**/infrastructure/**', 'node:sqlite'],
    'HTTP handlers must use application interfaces rather than storage implementations.',
  ),
  boundary(
    ['apps/web/src/features/workspace/{model,application}/**/*.ts'],
    [
      '**/infrastructure/**',
      '**/components/**',
      '**/pages/**',
      '**/app/bootstrap',
      'react',
      'react-dom',
    ],
    'Workspace state and commands depend on ports, not UI or browser adapters.',
  ),
  prettier,
);
