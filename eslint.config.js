const js = require('@eslint/js');
const ts = require('typescript-eslint');
const globals = require('globals');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**'] },
  {
    files: ['server.js', 'server/*.cjs', 'scripts/*.cjs', 'test/*.cjs'],
    ...js.configs.recommended,
    languageOptions: { globals: { ...globals.node, fetch: 'readonly', AbortController: 'readonly' }, sourceType: 'commonjs' },
    rules: { ...js.configs.recommended.rules, 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none', varsIgnorePattern: '^_' }] },
  },
  {
    files: ['scripts/export-legacy-cache.js'],
    ...js.configs.recommended,
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: ts.parser, globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    rules: { 'no-constant-condition': 'error', 'no-debugger': 'error', 'no-unreachable': 'error' },
  },
];
