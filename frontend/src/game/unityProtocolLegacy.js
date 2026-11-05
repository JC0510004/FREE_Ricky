// ─── COMPATIBILIDAD LEGACY (TEMPORAL) ──────────────────────────────────
// Traduce los mensajes históricos del build de Unity al contrato canónico de
// unityProtocol.js. Existe solo mientras el build no se actualice; no debe
// crecer con más alias. Se desactiva con VITE_UNITY_LEGACY_COMPAT=false.
//
// La traducción se hace aquí, no en Juego.jsx, y el resultado pasa por
// normalizarMensajeUnity(), así que sigue habiendo un único validador.

import { MENSAJE, normalizarMensajeUnity } from './unityProtocol'

const TIPOS_STATS = new Set([
  'stats',
  'hudUpdate',
  'gameStats',
  'updateStats',
  'finalStats',
  'endStats',
])

const ALIAS = {
  nivelId: ['nivelId', 'levelId', 'idNivel', 'nivel_id'],
  escena: ['escena', 'scene', 'nombreNivel'],
  muertes: ['muertes', 'muerte', 'deaths', 'vidasPerdidas', 'killCount', 'muertesTotales'],
  tiempo: ['tiempo', 'time', 'segundos', 'timer', 'elapsedTime', 'playTime', 'tiempoTranscurrido'],
  completado: ['completado', 'completed', 'win', 'won', 'victoria', 'exito'],
}

const ENVOLTORIOS = [
  'datos',
  'stats',
  'hud',
  'estado',
  'gameState',
  'data',
  'resultado',
  'partida',
  'final',
  'finalStats',
  'endStats',
]

function primerValor(objeto, campos) {
  for (const campo of campos) {
    if (objeto[campo] !== undefined) return { campo, valor: objeto[campo] }
  }
  return null
}

function extraerObjeto(raw) {
  for (const clave of ENVOLTORIOS) {
    const valor = raw[clave]
    if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
      return { objeto: valor, origen: clave }
    }
  }
  return { objeto: raw, origen: null }
}

function construirDatos(objeto, cambios) {
  const datos = {}
  for (const [canonico, alias] of Object.entries(ALIAS)) {
    const encontrado = primerValor(objeto, alias)
    if (!encontrado) continue
    datos[canonico] = encontrado.valor
    if (encontrado.campo !== canonico) {
      cambios.push(`campo "${encontrado.campo}" → "${canonico}"`)
    }
  }
  return datos
}

/**
 * Normaliza un mensaje legacy al contrato canónico.
 *
 * @param {unknown} raw - El `event.data` del postMessage.
 * @returns {{ tipo: string, datos: object|null, advertencias: string[] }|null}
 *   `null` si no es un mensaje legacy reconocible o no tiene datos válidos.
 */
export function normalizarMensajeUnityLegacy(raw) {
  if (!raw || typeof raw !== 'object') return null

  const tipo = raw.type
  if (tipo === MENSAJE.UNITY_LISTO) {
    return normalizarMensajeUnity(raw)
  }

  let tipoCanonico
  const cambios = []

  if (TIPOS_STATS.has(tipo)) {
    tipoCanonico = MENSAJE.STATS
    if (tipo !== MENSAJE.STATS) cambios.push(`tipo "${tipo}" → "${MENSAJE.STATS}"`)
  } else if (tipo === MENSAJE.RESULTADO || tipo === MENSAJE.SALIR) {
    tipoCanonico = tipo
  } else {
    return null
  }

  const { objeto, origen } = extraerObjeto(raw)
  if (origen && origen !== 'datos') {
    cambios.push(`datos extraídos de "${origen}"`)
  }

  const datos = construirDatos(objeto, cambios)
  const mensaje = normalizarMensajeUnity({ type: tipoCanonico, datos })
  if (!mensaje) return null

  if (cambios.length > 0) {
    mensaje.advertencias.push(`legacy: ${cambios.join(', ')}`)
  }
  return mensaje
}

/** Variantes históricas de la petición de estadísticas. */
export function solicitudesStatsLegacy() {
  return [
    { type: 'solicitarDatos' },
    { type: 'pedirStats' },
    { type: 'getStats' },
    { type: 'requestStats' },
    { type: 'getFinalStats' },
    { type: 'enviarDatos' },
    { type: 'finalizarPartida' },
    { type: 'getGameData' },
    { action: 'getStats' },
  ]
}
