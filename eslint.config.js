import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `scratch/` son scripts sueltos de mantenimiento (Node), fuera de la app.
  globalIgnores(['dist', 'dev-dist', 'scratch']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Sin eslint-plugin-react, `<motion.div>` no cuenta como uso de `motion`.
      'no-unused-vars': ['error', { varsIgnorePattern: '^(?:[A-Z_]|motion$)' }],
      // Arquitectura: sólo `src/services/` habla con Supabase (ver docs/ARQUITECTURA.md).
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@supabase/*'], message: 'Usá un servicio de src/services/ en lugar de Supabase directo.' },
          { group: ['**/supabaseClient', '**/supabaseClient.js'], message: 'Usá un servicio de src/services/ en lugar del cliente directo.' },
        ],
      }],
    },
  },
  {
    files: ['src/services/**/*.js'],
    rules: { 'no-restricted-imports': 'off' },
  },
])
