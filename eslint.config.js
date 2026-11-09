import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'release'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, complexity: ['warn', 5] },
  },
  { files: ['electron/**/*.cjs', 'scripts/**/*.cjs'], languageOptions: { globals: globals.node, sourceType: 'commonjs' }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  { files: ['scripts/**/*.mjs', 'electron/**/*.mjs'], languageOptions: { globals: globals.node } },
);
