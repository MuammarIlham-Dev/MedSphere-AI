import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'node_modules', '**/*.config.*', 'supabase/functions'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  { languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } } },
  { plugins: { 'react-hooks': reactHooks }, rules: { ...reactHooks.configs.recommended.rules } },
  { rules: { '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }] } },
);
