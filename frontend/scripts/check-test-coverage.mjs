// ─── GUARD DE COBERTURA DE TESTS ────────────────────────────────────────
// Previene el fallo que ya ocurrió una vez: dos archivos de test guardados
// como `Protectedroute.test` y `Authcontext.test`, SIN extensión. El include
// de vite.config.js es `src/**/*.{test,spec}.{js,jsx}`, así que Vitest nunca
// los vio: la suite reportaba 7 archivos y 40 tests en verde mientras 25
// tests estaban en disco sin ejecutarse.
//
// Esa es la peor clase de fallo en CI — no se ve. Un guard de conteo solo
// no basta, porque el conteo de Vitest también estaba mal: reportaba 40 con
// la verdad en disco. Por eso este script NO cuenta tests, sino que compara
// lo que parece un test en disco contra lo que el include de Vitest matchea.
// La diferencia entre ambos conjuntos es el bug.
//
// Uso: node scripts/check-test-coverage.mjs
// Salida: exit 1 si algún archivo parece test pero no lo ejecuta Vitest,
//         o si no hay ningún test (una suite vacía pasa en verde).

import { readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(ROOT, 'src')

// Extensiones que el include de vite.config.js recoge. Si alguien añade una
// extensión nueva ahí, hay que añadirla también aquí o el guard dará falso
// positivo — que es el comportamiento que queremos: que llame la atención.
const MATCHED_EXTENSIONS = ['.test.js', '.test.jsx', '.spec.js', '.spec.jsx']

// Patrón para detectar un archivo "que parece un test" sin conocer su
// extensión. El bug original era exactamente un archivo sin extensión, así
// que el patrón tiene que ser deliberadamente más laxo que el include:
// cualquier basename con un token test/spec, con o sin extensión, y
// cualquier extension, incluidas las desconocidas.
const LOOKS_LIKE_TEST = /(^|[^a-z0-9])(test|tests|spec|specs)([^a-z0-9]|$)/i

function walk(dir) {
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full))
    else if (statSync(full).isFile()) found.push(full)
  }
  return found
}

function toPosix(p) {
  return relative(ROOT, p).split(sep).join('/')
}

function isMatched(file) {
  const name = file.split(sep).pop()
  return MATCHED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

const all = walk(SRC)
const candidates = all.filter((f) => LOOKS_LIKE_TEST.test(f.split(sep).pop()))
const matched = candidates.filter(isMatched)
const orphans = candidates.filter((f) => !isMatched(f))

console.log(`Guard de tests: ${matched.length} archivo(s) scraped por Vitest de ${candidates.length} candidato(s).`)

if (candidates.length === 0) {
  console.error('\nFALLO: no se encontró ningún archivo de test bajo src/.')
  console.error('Una suite vacía pasa en verde, así que esto debe fallar.')
  process.exit(1)
}

if (orphans.length > 0) {
  console.error(`\nFALLO: ${orphans.length} archivo(s) parecen test pero Vitest NO los ejecuta:`)
  for (const f of orphans) console.error(`  - ${toPosix(f)}`)
  console.error('\nCausas habituales:')
  console.error('  1. Falta la extensión .js/.jsx (el include de vite.config.js exige una).')
  console.error('  2. Mayúscula/minúscula distinta: Protectedroute.test no coincide con *.test.*.')
  console.error('  3. Extensión no recognized por el include.')
  console.error('\nRenombra el archivo o amplía el include de vite.config.js y')
  console.error('MATCHED_EXTENSIONS en este script a la vez.')
  process.exit(1)
}

console.log(`OK: los ${matched.length} archivo(s) de test están incluidos en la suite.`)
for (const f of matched) console.log(`  - ${toPosix(f)}`)
