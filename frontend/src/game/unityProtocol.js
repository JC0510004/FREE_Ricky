// ─── CONTRATO DE COMUNICACIÓN WEB ⇄ UNITY ──────────────────────────────
// Único punto donde se define y valida el formato de los mensajes que el
// build de Unity WebGL intercambia con la página. Antes esta lógica vivía
// repartida en Juego.jsx como una lista de alias (muertes/muerte/deaths/...,
// completado/completed/victoria/...) y múltiples envoltorios anidados. Eso
// hacía que un cambio de nombre en el juego no fallara de forma visible:
// simplemente se guardaban 0 muertes o la partida se marcaba mal.
//
// A partir de aquí solo se aceptan los campos del contrato. Cualquier otro
// mensaje se rechaza y Juego.jsx lo avisa por consola.
//
// Documentación completa: docs/PROTOCOLO_UNITY.md
//
// Mensajes del JUEGO → WEB (siempre con `type`):
//   { type: 'unityListo' }
//   { type: 'stats', datos: { muertes?: number, tiempo?: number } }
//   { type: 'resultadoPartida', datos: {
//       nivelId?: number, escena?: string,
//       muertes: number, tiempo: number, completado: boolean
//     } }
//   { type: 'salirPanel', datos?: {
//       nivelId?: number, escena?: string,
//       muertes?: number, tiempo?: number, completado?: boolean
//     } }
//
// Mensajes de la WEB → JUEGO:
//   { type: 'setPlayerName', nombre: string }
//   { type: 'cargarNivel', nivel: number }
//   { type: 'solicitarDatos' }
//
// Los datos pueden venir dentro de `datos` (forma canónica) o en la raíz del
// mensaje (forma plana, aceptada por compatibilidad). No se aceptan alias de
// campos: el campo se llama `muertes`, no `deaths`.

export const MENSAJE = Object.freeze({
  UNITY_LISTO: 'unityListo',
  STATS: 'stats',
  RESULTADO: 'resultadoPartida',
  SALIR: 'salirPanel',
})

const TIPOS_VALIDOS = new Set(Object.values(MENSAJE))

/**
 * Normaliza el origen de `VITE_GAME_ORIGIN` para compararlo con `event.origin`.
 * `event.origin` nunca lleva barra final ni ruta.
 *
 * @param {string} valor
 * @returns {string}
 */
export function normalizarOrigen(valor) {
  try {
    return new URL(valor).origin
  } catch {
    return String(valor).replace(/\/+$/, '')
  }
}

function numeroNoNegativo(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0
    ? valor
    : null
}

function enteroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0 ? valor : null
}

function textoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null
}

function normalizarDatos(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) return null

  return {
    nivelId: enteroPositivo(datos.nivelId),
    escena: textoNoVacio(datos.escena),
    muertes: numeroNoNegativo(datos.muertes),
    tiempo: numeroNoNegativo(datos.tiempo),
    completado: typeof datos.completado === 'boolean' ? datos.completado : null,
  }
}

function tieneAlgunDato(datos) {
  return datos.nivelId !== null
    || datos.escena !== null
    || datos.muertes !== null
    || datos.tiempo !== null
    || datos.completado !== null
}

/**
 * Valida y normaliza un mensaje recibido del juego.
 *
 * @param {unknown} raw - El `event.data` del postMessage.
 * @returns {{ tipo: string, datos: object|null, advertencias: string[] }|null}
 *   `null` si el mensaje no cumple el contrato (tipo desconocido, sin datos
 *   utilizables o con campos de tipo incorrecto).
 */
export function normalizarMensajeUnity(raw) {
  if (!raw || typeof raw !== 'object') return null

  const tipo = raw.type
  if (!TIPOS_VALIDOS.has(tipo)) return null

  if (tipo === MENSAJE.UNITY_LISTO) {
    return { tipo, datos: null, advertencias: [] }
  }

  const advertencias = []
  // `datos: null` no es un envoltorio: se ignora y se mira la raíz, igual que
  // si el campo no existiera.
  const usaEnvoltorio = raw.datos !== undefined && raw.datos !== null
  const datos = normalizarDatos(usaEnvoltorio ? raw.datos : raw)
  if (!datos) return null

  if (!usaEnvoltorio && tieneAlgunDato(datos)) {
    advertencias.push('datos en la raíz; el contrato los espera en "datos"')
  }

  if (tipo === MENSAJE.STATS) {
    if (datos.muertes === null && datos.tiempo === null) return null
    return { tipo, datos, advertencias }
  }

  if (tipo === MENSAJE.RESULTADO) {
    // Un resultado sin ningún dato no se puede guardar.
    if (!tieneAlgunDato(datos)) return null
    // `completado` es obligatorio en el contrato. Mientras el build de Unity
    // no lo envíe se mantiene el comportamiento histórico (resultadoPartida
    // = victoria) y se avisa, en vez de guardar la partida como derrota.
    if (datos.completado === null) {
      datos.completado = true
      advertencias.push('resultadoPartida sin "completado"; se asume true')
    }
    return { tipo, datos, advertencias }
  }

  // SALIR: los datos son opcionales (si no llegan, Juego.jsx los pide). Si el
  // juego no lo marca explícitamente como completado, es un abandono.
  if (datos.completado === null) datos.completado = false
  return { tipo, datos, advertencias }
}
