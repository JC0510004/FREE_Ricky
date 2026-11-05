import { describe, it, expect } from 'vitest'
import { MENSAJE } from './unityProtocol'
import {
  normalizarMensajeUnityLegacy,
  solicitudesStatsLegacy,
} from './unityProtocolLegacy'

describe('normalizarMensajeUnityLegacy', () => {
  it('mapea los tipos legacy de stats y sus alias de campos', () => {
    const mensaje = normalizarMensajeUnityLegacy({
      type: 'hudUpdate',
      datos: { deaths: 3, time: 10 },
    })

    expect(mensaje.tipo).toBe(MENSAJE.STATS)
    expect(mensaje.datos).toMatchObject({ muertes: 3, tiempo: 10 })
    expect(mensaje.advertencias.join(' ')).toContain('legacy')
  })

  it('extrae los datos de un envoltorio legacy', () => {
    const mensaje = normalizarMensajeUnityLegacy({
      type: 'salirPanel',
      stats: { muertes: 2, tiempo: 20 },
    })

    expect(mensaje.datos).toMatchObject({ muertes: 2, tiempo: 20 })
    expect(mensaje.advertencias.join(' ')).toContain('"stats"')
  })

  it('mapea completado desde win/completed', () => {
    const mensaje = normalizarMensajeUnityLegacy({
      type: 'resultadoPartida',
      datos: { muertes: 1, tiempo: 5, win: true },
    })

    expect(mensaje.datos.completado).toBe(true)
    expect(mensaje.advertencias.join(' ')).toContain('"win"')
  })

  it('usa la raíz si datos es null', () => {
    const mensaje = normalizarMensajeUnityLegacy({
      type: 'salirPanel',
      datos: null,
      muertes: 4,
      tiempo: 40,
    })

    expect(mensaje.datos).toMatchObject({ muertes: 4, tiempo: 40 })
  })

  it('mantiene el contrato canónico sin aviso legacy', () => {
    const mensaje = normalizarMensajeUnityLegacy({
      type: 'stats',
      datos: { muertes: 1, tiempo: 2 },
    })

    expect(mensaje.datos).toMatchObject({ muertes: 1, tiempo: 2 })
    expect(mensaje.advertencias).toEqual([])
  })

  it('no acepta tipos desconocidos ni mensajes sin datos utilizables', () => {
    expect(normalizarMensajeUnityLegacy({
      type: 'otro',
      datos: { muertes: 1, tiempo: 2 },
    })).toBeNull()

    expect(normalizarMensajeUnityLegacy({
      type: 'hudUpdate',
      datos: { foo: 1 },
    })).toBeNull()
  })
})

describe('solicitudesStatsLegacy', () => {
  it('incluye solicitarDatos y las variantes históricas', () => {
    const solicitudes = solicitudesStatsLegacy()

    expect(solicitudes[0]).toEqual({ type: 'solicitarDatos' })
    expect(solicitudes).toEqual(expect.arrayContaining([
      { type: 'pedirStats' },
      { type: 'getStats' },
      { type: 'requestStats' },
      { type: 'getFinalStats' },
      { type: 'enviarDatos' },
      { type: 'finalizarPartida' },
      { type: 'getGameData' },
      { action: 'getStats' },
    ]))
    expect(solicitudes).toHaveLength(9)
  })
})
