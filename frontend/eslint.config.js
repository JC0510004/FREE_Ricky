import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
// ─── jsx-a11y ───────────────────────────────────────────────────────────
// Sin este plugin, ESLint no veía ninguno de los problemas de accesibilidad
// del proyecto (hallazgo 4.15 de AUDITORIA.md). Se activa el set "recommended",
// que es el mínimo razonable: cubre alt, roles, etiquetado de formularios,
// contraste implícito de nombres accesibles y teclado.
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Artefactos generados y de terceros, no versionados: 'public' contiene el
  // build de Unity WebGL y 'coverage' la salida de los tests. Lintarlos genera
  // cientos de avisos ajenos al proyecto que no se pueden corregir.
  globalIgnores(['dist', 'coverage', 'public', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Los archivos del E2E y la configuración de Playwright corren en Node,
  // donde existe `process`.
  {
    files: ['e2e/**/*.js', 'playwright.config.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
])