import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginJest from 'eslint-plugin-jest'
import eslintConfigPrettier from 'eslint-config-prettier'

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ['src/**/*.{js,mjs,cjs,ts}', 'test/**/*.{js,mjs,cjs,ts}'] },
  { ignores: ['dist'] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['test/**/*.{js,mjs,cjs,ts}'],
    ...pluginJest.configs['flat/recommended'],
  },
  eslintConfigPrettier,
]
