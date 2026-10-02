import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  { plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules } },
  { rules: { '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }] } },
);
